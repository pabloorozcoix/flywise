"""Flight search orchestration — manages search lifecycle and execution.

This module owns:

* The in-memory search store (``_active_searches`` dict).
* The concurrency semaphore (``_semaphore``).
* Two search strategies dispatched by ``EXTRACTION_MODE``:
  - ``direct`` — ``page.goto()`` + ``page.evaluate()`` + ``text_parser``
  - ``agent`` — browser-use ``Agent`` with LLM-driven extraction
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
from app.services.browser import close_browser, create_agent_browser, create_stealth_browser, take_screenshot
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
    """Dispatch to the configured extraction strategy.

    Reads ``EXTRACTION_MODE`` from settings:
    - ``"direct"`` → ``_run_search_direct()`` (page.goto + JS extraction)
    - ``"agent"`` → ``_run_search_agent()`` (browser-use Agent + LLM)
    """
    settings = get_settings()
    mode = settings.extraction_mode.lower()

    if mode == "agent":
        await _run_search_agent(search_id, request)
    else:
        await _run_search_direct(search_id, request)


async def _run_search_direct(search_id: str, request: FlightSearchRequest) -> None:
    """Direct automation: navigate to Kayak, inject JS, parse with regex.

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


async def _run_search_agent(search_id: str, request: FlightSearchRequest) -> None:
    """Agent-driven search: browser-use Agent with LLM-powered extraction.

    The Agent autonomously browses the page, dismisses dialogs, runs
    JavaScript extraction, parses results, and calls ``done``.  Progress
    events are streamed via the ``register_new_step_callback``.
    """
    assert _semaphore is not None, "Search manager not initialised — call initialize() first"

    browser = None
    settings = get_settings()

    async with _semaphore:
        try:
            # Step 0 — Initialise browser for Agent
            _add_progress(search_id, ProgressEvent(
                step=0,
                thinking="Initializing AI agent with browser...",
                next_goal="Launch agent browser",
            ))

            search_url = build_kayak_url(
                origin=request.origin,
                destination=request.destination,
                departure_date=request.departure_date,
                return_date=request.return_date,
                cabin_class=request.cabin_class,
                direct_only=request.direct_only,
            )
            logger.info(f"[{search_id}] Agent mode — Search URL: {search_url}")

            browser = await create_agent_browser()

            # Pre-navigate to the Kayak URL so the Agent starts on the right page
            page = await browser.get_current_page()
            if page:
                await page.goto(search_url)
                logger.info(f"[{search_id}] Pre-navigated to {search_url}")
                # Wait for page to render before handing to Agent
                await asyncio.sleep(15)

            # Step 1 — Build agent prompt and LLM
            _add_progress(search_id, ProgressEvent(
                step=1,
                thinking="Configuring AI agent with LLM...",
                url=search_url,
                next_goal="Create agent",
            ))

            # Lazy imports — heavy dependencies
            from browser_use import Agent  # noqa: WPS433
            from app.models.domain import FlightResultsOutput
            from app.parsers.flight_parser import parse_flight_results
            from app.prompts.kayak import build_flight_search_prompt

            llm = _create_llm(settings)

            prompt = build_flight_search_prompt(
                origin=request.origin,
                destination=request.destination,
                departure_date=request.departure_date,
                return_date=request.return_date,
                cabin_class=request.cabin_class,
                direct_only=request.direct_only,
            )

            # Step counter for agent progress
            agent_step_counter = {"value": 2}

            async def on_step_start(agent_instance: Any) -> None:
                """Emit a progress event when the Agent starts a new step.

                This is an async callback matching the browser-use
                ``AgentHookFunc = Callable[[Agent], Awaitable[None]]`` signature.
                """
                step_num = agent_step_counter["value"]
                agent_step_counter["value"] += 1

                thinking = ""
                next_goal = ""
                actions: list[str] = []

                # Extract info from the agent's current state if available
                state = getattr(agent_instance, "state", None)
                if state is not None:
                    model_output = getattr(state, "last_model_output", None)
                    if model_output is not None:
                        mo = model_output
                        current_state = getattr(mo, "current_state", None)
                        if isinstance(current_state, dict):
                            thinking = current_state.get("thought", "")
                            next_goal = current_state.get("next_goal", "")
                        if hasattr(mo, "action") and mo.action:
                            for act in mo.action:
                                act_dict = act.model_dump(exclude_none=True) if hasattr(act, "model_dump") else {}
                                actions.extend(list(act_dict.keys()))

                _add_progress(search_id, ProgressEvent(
                    step=step_num,
                    thinking=thinking or f"Agent step {step_num - 1}...",
                    next_goal=next_goal or "Processing",
                    actions=actions,
                    url=search_url,
                ))

            # Create and run the Agent
            agent = Agent(
                task=prompt,
                llm=llm,
                browser=browser,
                output_model_schema=FlightResultsOutput,
                max_failures=settings.agent_max_failures,
                final_response_after_failure=True,
                use_vision=True,
                max_actions_per_step=5,
            )

            logger.info(f"[{search_id}] Running agent (max_steps={settings.agent_max_steps})")
            history = await agent.run(
                max_steps=settings.agent_max_steps,
                on_step_start=on_step_start,
            )

            # Parse results from agent history using 7-strategy parser
            results = parse_flight_results(history)
            logger.info(f"[{search_id}] Agent extracted {len(results)} flights")

            # Final screenshot
            final_page = await browser.get_current_page()
            final_ss = await take_screenshot(final_page) if final_page else None

            # Done step
            _add_progress(search_id, ProgressEvent(
                step=agent_step_counter["value"],
                thinking=f"Agent done — found {len(results)} flights",
                url=search_url,
                next_goal="Complete",
                screenshot=final_ss,
            ))

            _complete_search(search_id, results)
            logger.info(f"[{search_id}] Agent search completed with {len(results)} results")
            await notify_callback(search_id, "completed", results)

        except asyncio.CancelledError:
            logger.info(f"[{search_id}] Agent search cancelled by user")
            _cancel_search(search_id)
            await notify_callback(search_id, "cancelled")

        except Exception as exc:
            logger.error(f"[{search_id}] Agent search failed: {exc}", exc_info=True)
            _fail_search(search_id, str(exc))
            await notify_callback(search_id, "failed", error=str(exc))

        finally:
            await close_browser(browser, search_id)


def _create_llm(settings: Any) -> Any:
    """Create the LLM instance based on configuration.

    If an OpenAI API key is configured, uses browser-use's ChatOpenAI.
    Otherwise falls back to ChatOllama (local Ollama).

    browser-use >= 0.12 ships its own ``ChatOpenAI`` / ``ChatOllama``
    dataclasses that implement its ``BaseChatModel`` Protocol (provider,
    ainvoke, etc.).  We import from ``browser_use`` — **not** langchain.

    Args:
        settings: Application settings.

    Returns:
        A browser-use compatible chat model.
    """
    if settings.openai_api_key:
        from browser_use import ChatOpenAI  # noqa: WPS433

        logger.info(f"Using OpenAI model: {settings.openai_model}")
        return ChatOpenAI(
            model=settings.openai_model,
            api_key=settings.openai_api_key,
        )

    from browser_use import ChatOllama  # noqa: WPS433

    logger.info(f"Using Ollama model: {settings.ollama_model} at {settings.ollama_host}")
    return ChatOllama(
        model=settings.ollama_model,
        host=settings.ollama_host,
    )


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
