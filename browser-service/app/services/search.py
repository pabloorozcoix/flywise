"""Flight search orchestration — manages search lifecycle and execution.

This module owns:

* The in-memory search store (``_active_searches`` dict).
* The concurrency semaphore (``_semaphore``).
* The background search task (``_run_search``).
* Helper functions for routes to query/modify search state.

All state is module-level because FastAPI runs in a single process
and the service is stateless across restarts (in-memory only).
"""

from __future__ import annotations

import asyncio
import json
import random
import uuid
from typing import Any

from app.config import get_settings
from app.constants.selectors import EXTRACTION_JS
from app.logger import get_logger
from app.models.domain import FlightResult, ProgressEvent, SearchStatus
from app.models.enums import SearchStatusValue
from app.models.requests import FlightSearchRequest
from app.parsers.text_parser import parse_raw_text_to_flight, try_parse_plain_text_flights
from app.prompts.kayak import build_kayak_url
from app.services.browser import close_browser, create_stealth_browser, take_screenshot
from app.services.callback import notify_callback

logger = get_logger("services.search")

# ── Module-level state ──────────────────────────────────────────

_active_searches: dict[str, SearchStatus] = {}
_active_tasks: dict[str, asyncio.Task] = {}
_semaphore: asyncio.Semaphore | None = None


# ── Initialisation ──────────────────────────────────────────────


def initialize(max_concurrent: int) -> None:
    """Initialise the concurrency semaphore.

    Must be called once during application startup (lifespan event).

    Args:
        max_concurrent: Maximum number of simultaneous browser searches.
    """
    global _semaphore  # noqa: WPS420
    _semaphore = asyncio.Semaphore(max_concurrent)
    logger.info(f"Search manager initialised (max_concurrent={max_concurrent})")


# ── Query helpers (used by routes) ──────────────────────────────


def get_search(search_id: str) -> SearchStatus | None:
    """Retrieve search status by ID, or ``None`` if not found."""
    return _active_searches.get(search_id)


def is_at_capacity() -> bool:
    """Return ``True`` if all search slots are occupied."""
    if _semaphore is None:
        return False
    return _semaphore.locked() and _semaphore._value == 0


# ── Search entry-point ──────────────────────────────────────────


async def start_search(request: FlightSearchRequest) -> str:
    """Register a new search and spawn its background task.

    Args:
        request: Validated flight search request.

    Returns:
        The search ID (caller-provided or auto-generated UUID).
    """
    search_id = request.search_id or str(uuid.uuid4())

    _active_searches[search_id] = SearchStatus(
        search_id=search_id,
        status=SearchStatusValue.RUNNING,
    )

    task = asyncio.create_task(_run_search(search_id, request))
    _active_tasks[search_id] = task

    # Remove the task reference once it completes
    task.add_done_callback(lambda _t: _active_tasks.pop(search_id, None))
    return search_id


# ── Background search task ──────────────────────────────────────


async def _run_search(search_id: str, request: FlightSearchRequest) -> None:
    """Navigate to Kayak, extract flight data, and parse results.

    Uses direct BrowserSession navigation (not the Agent) because:
    - The Agent creates a new tab/target which lacks the stealth JS.
    - Direct ``page.goto()`` on the stealth-injected target works reliably.
    """
    assert _semaphore is not None, "Search manager not initialised — call initialize() first"

    browser = None

    async with _semaphore:
        try:
            # Step 0 — Initialise browser
            _add_progress(search_id, ProgressEvent(
                step=0,
                thinking="Initializing browser with stealth configuration...",
                next_goal="Launch browser",
            ))

            search_url = build_kayak_url(
                origin=request.origin,
                destination=request.destination,
                departure_date=request.departure_date,
                return_date=request.return_date,
                cabin_class=request.cabin_class,
                direct_only=request.direct_only,
            )
            logger.info(f"[{search_id}] Search URL: {search_url}")

            browser = await create_stealth_browser()

            # Random delay to appear human-like
            await asyncio.sleep(random.uniform(1.0, 3.0))

            # Step 1 — Navigate
            _add_progress(search_id, ProgressEvent(
                step=1,
                thinking=f"Navigating to Kayak: {search_url}",
                url=search_url,
                next_goal="Load flight results",
            ))

            page = await browser.get_current_page()
            if not page:
                raise RuntimeError("BrowserSession has no current page after start()")

            await page.goto(search_url)
            logger.info(f"[{search_id}] Navigation started")

            # Step 2 — Wait for results
            _add_progress(search_id, ProgressEvent(
                step=2,
                thinking="Waiting 15 seconds for Kayak to render flight results...",
                url=search_url,
                next_goal="Wait for results",
            ))
            await asyncio.sleep(15)

            final_url = str(page.url) if hasattr(page, "url") else search_url
            logger.info(f"[{search_id}] Page loaded — final URL: {final_url}")

            # Capture screenshot of the loaded results page
            ss_b64 = await take_screenshot(page)
            if ss_b64 and search_id in _active_searches:
                progress = _active_searches[search_id].progress
                if progress:
                    progress[-1].screenshot = ss_b64
                logger.info(f"[{search_id}] Screenshot captured")

            # Step 3 — Extract via JavaScript
            _add_progress(search_id, ProgressEvent(
                step=3,
                thinking="Extracting flight data from page DOM...",
                url=final_url,
                next_goal="Extract flights via JS",
            ))

            raw_result = await page.evaluate(EXTRACTION_JS)
            logger.info(f"[{search_id}] JS extraction returned {len(str(raw_result))} chars")

            # Step 4 — Parse
            _add_progress(search_id, ProgressEvent(
                step=4,
                thinking=f"Parsing extracted flight data ({len(str(raw_result))} chars)...",
                url=final_url,
                next_goal="Parse flight results",
            ))

            results = _parse_extraction(raw_result, search_id)

            # Step 5 — Done
            final_ss = await take_screenshot(page)
            _add_progress(search_id, ProgressEvent(
                step=5,
                thinking=f"Done — found {len(results)} flights",
                url=final_url,
                next_goal="Complete",
                screenshot=final_ss,
            ))

            # Mark completed
            _complete_search(search_id, results)
            logger.info(f"[{search_id}] Search completed with {len(results)} results")
            await notify_callback(search_id, "completed", results)

        except asyncio.CancelledError:
            logger.info(f"[{search_id}] Search cancelled by user")
            _cancel_search(search_id)
            await notify_callback(search_id, "cancelled")

        except Exception as exc:
            logger.error(f"[{search_id}] Search failed: {exc}", exc_info=True)
            _fail_search(search_id, str(exc))
            await notify_callback(search_id, "failed", error=str(exc))

        finally:
            await close_browser(browser, search_id)


# ── Private helpers ─────────────────────────────────────────────


def _add_progress(search_id: str, event: ProgressEvent) -> None:
    """Append a progress event to the search's timeline."""
    status = _active_searches.get(search_id)
    if status is not None:
        status.progress.append(event)


def _complete_search(search_id: str, results: list[FlightResult]) -> None:
    """Mark a search as completed with results."""
    if search_id in _active_searches:
        _active_searches[search_id].status = SearchStatusValue.COMPLETED
        _active_searches[search_id].results = results
    else:
        _active_searches[search_id] = SearchStatus(
            search_id=search_id,
            status=SearchStatusValue.COMPLETED,
            results=results,
        )


def _fail_search(search_id: str, error: str) -> None:
    """Mark a search as failed with an error message."""
    if search_id in _active_searches:
        _active_searches[search_id].status = SearchStatusValue.FAILED
        _active_searches[search_id].error = error
    else:
        _active_searches[search_id] = SearchStatus(
            search_id=search_id,
            status=SearchStatusValue.FAILED,
            error=error,
        )


def _cancel_search(search_id: str) -> None:
    """Mark a search as cancelled."""
    if search_id in _active_searches:
        _active_searches[search_id].status = SearchStatusValue.CANCELLED
        _active_searches[search_id].error = "Search cancelled by user"
    else:
        _active_searches[search_id] = SearchStatus(
            search_id=search_id,
            status=SearchStatusValue.CANCELLED,
            error="Search cancelled by user",
        )


async def cancel_search(search_id: str) -> bool:
    """Cancel a running search by its ID.

    Cancels the underlying asyncio task, which triggers ``CancelledError``
    inside ``_run_search`` and cleans up the browser.

    Args:
        search_id: The search to cancel.

    Returns:
        ``True`` if the search was running and has been cancelled,
        ``False`` if the search was not found or already terminal.
    """
    task = _active_tasks.get(search_id)
    if task is None or task.done():
        return False
    task.cancel()
    logger.info(f"[{search_id}] Cancel requested")
    return True


def _parse_extraction(raw_result: Any, search_id: str) -> list[FlightResult]:
    """Parse raw JS evaluation output into :class:`FlightResult` objects."""
    results: list[FlightResult] = []

    if not raw_result:
        return results

    raw_str = str(raw_result)

    # Try JSON array first (from .nrc6-wrapper extraction)
    try:
        cards_data = json.loads(raw_str)
        if isinstance(cards_data, list):
            for card in cards_data:
                raw_text = card.get("raw_text", "") if isinstance(card, dict) else str(card)
                parsed = parse_raw_text_to_flight(raw_text)
                if parsed:
                    results.append(parsed)
            logger.info(f"[{search_id}] Parsed {len(results)} flights from JSON array")
    except (json.JSONDecodeError, TypeError):
        # Not JSON — parse as raw page text
        plain_results = try_parse_plain_text_flights(raw_str)
        if plain_results:
            results = plain_results
        logger.info(f"[{search_id}] Parsed {len(results)} flights from raw text")

    return results
