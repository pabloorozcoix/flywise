"""Browser-Use FastAPI Service — HTTP wrapper around browser-use library."""

import asyncio
import json
import logging
import os
import random
import uuid
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from models import (
    FlightSearchRequest,
    FlightSearchResponse,
    FlightResult,
    FlightResultsOutput,
    HealthResponse,
    SearchStatus,
)
from prompts import build_kayak_url

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("browser-use-service")

# FastAPI app
app = FastAPI(
    title="Browser-Use Flight Search Service",
    description="FastAPI wrapper around browser-use for AI-powered flight search",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for active searches (replaced by DB in production)
active_searches: dict[str, SearchStatus] = {}

# Ollama host and model from environment
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")

# Optional OpenAI model (used only when user provides an API key)
# gpt-4.1-mini: cheapest vision-capable model that works well with browser-use
OPENAI_MODEL = "gpt-4.1-mini"

# Fall back to env var when no per-request key is provided
OPENAI_API_KEY_ENV = os.getenv("OPENAI_API_KEY", "")

# Next.js callback URL for persisting results
NEXTJS_CALLBACK_URL = os.getenv(
    "NEXTJS_CALLBACK_URL", "http://nextjs:3000/api/callback/search-complete"
)

# Maximum concurrent searches (rate limiting)
MAX_CONCURRENT_SEARCHES = int(os.getenv("MAX_CONCURRENT_SEARCHES", "3"))
_search_semaphore = asyncio.Semaphore(MAX_CONCURRENT_SEARCHES)

# Stealth user agents for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
]

# Stealth JavaScript injected via CDP before any navigation.
# Overrides common headless-browser fingerprints that trigger bot detection.
STEALTH_JS = """
// Override navigator.webdriver — the #1 headless detection signal
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});

// Add Chrome runtime object (present in real Chrome, missing in headless)
window.chrome = {runtime: {}, loadTimes: function(){}, csi: function(){}, app: {}};

// Override permissions API to return real-looking results
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
    parameters.name === 'notifications' ?
        Promise.resolve({state: Notification.permission}) :
        originalQuery(parameters);

// Override plugins (headless returns empty array)
Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
});

// Override languages (ensure realistic values)
Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
});
"""


def _get_stealth_browser_config() -> dict:
    """Get browser configuration with stealth settings to avoid detection."""
    return {
        "headless": True,
        "user_agent": random.choice(USER_AGENTS),
        "args": [
            "--disable-blink-features=AutomationControlled",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-infobars",
        ],
        "window_size": {"width": 1920, "height": 1080},
        "disable_security": True,
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(status="ok")


async def _notify_callback(search_id: str, status: str, results: list[FlightResult] | None = None, error: str | None = None) -> None:
    """Send results back to the Next.js callback endpoint for DB persistence."""
    payload: dict[str, Any] = {"search_id": search_id, "status": status}
    if results is not None:
        payload["results"] = [r.model_dump() for r in results]
    if error is not None:
        payload["error"] = error

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(NEXTJS_CALLBACK_URL, json=payload)
            if resp.status_code != 200:
                logger.warning(f"Callback returned {resp.status_code}: {resp.text}")
            else:
                logger.info(f"Callback succeeded for search {search_id}")
    except Exception as e:
        logger.error(f"Failed to notify callback for search {search_id}: {e}")


@app.post("/search", response_model=FlightSearchResponse)
async def search_flights(request: FlightSearchRequest):
    """
    Initiate a flight search using browser-use agent.

    Accepts the search request, returns immediately with status "running",
    and processes the search in a background task.  The WebSocket endpoint
    and /status/{search_id} can be used to track progress.
    """
    search_id = request.search_id or str(uuid.uuid4())
    logger.info(f"Starting flight search {search_id}: {request.origin} → {request.destination}")

    # Rate limiting — reject if too many concurrent searches
    if _search_semaphore.locked() and _search_semaphore._value == 0:
        logger.warning(f"Rate limit reached, rejecting search {search_id}")
        raise HTTPException(
            status_code=429,
            detail=f"Too many concurrent searches (max {MAX_CONCURRENT_SEARCHES}). Please try again shortly.",
        )

    # Track search status
    active_searches[search_id] = SearchStatus(
        search_id=search_id,
        status="running",
    )

    # Launch the search in the background so the HTTP response returns immediately.
    asyncio.create_task(_run_search(search_id, request))

    return FlightSearchResponse(
        search_id=search_id,
        status="running",
        results=[],
    )


async def _run_search(search_id: str, request: FlightSearchRequest) -> None:
    """Background task: navigate to Kayak, extract flight data, parse results.

    Uses direct BrowserSession navigation (not the Agent) because:
    - The Agent creates a new tab/target which lacks the stealth JS
    - Direct page.goto() on the stealth-injected target works reliably
    - Confirmed by test_selectors.py: 15 flight cards extracted successfully
    """
    browser = None
    async with _search_semaphore:
        try:
            from browser_use import Browser

            # ── Progress helpers ──
            def _progress(step: int, msg: str, url: str | None = None, goal: str = ""):
                if search_id in active_searches:
                    active_searches[search_id].progress.append({
                        "step": step,
                        "url": url,
                        "title": None,
                        "thinking": msg,
                        "evaluation": None,
                        "memory": None,
                        "next_goal": goal,
                        "actions": [],
                        "screenshot": None,
                    })

            _progress(0, "Initializing browser with stealth configuration...", goal="Launch browser")

            # ── Build search URL ──
            search_url = build_kayak_url(
                origin=request.origin,
                destination=request.destination,
                departure_date=request.departure_date,
                return_date=request.return_date,
                cabin_class=request.cabin_class,
                direct_only=request.direct_only,
            )
            logger.info(f"[{search_id}] Search URL: {search_url}")

            # ── Create and start browser with stealth ──
            stealth_config = _get_stealth_browser_config()
            browser = Browser(**stealth_config)
            await browser.start()
            logger.info(f"[{search_id}] Browser started with stealth config")

            # Inject stealth JS via CDP on the initial target.
            # CRITICAL: Page.addScriptToEvaluateOnNewDocument is per-target.
            # We navigate on THIS target (not a new tab) so stealth applies.
            cdp = await browser.get_or_create_cdp_session()
            await cdp.cdp_client.send.Page.enable(session_id=cdp.session_id)
            await cdp.cdp_client.send.Page.addScriptToEvaluateOnNewDocument(
                params={"source": STEALTH_JS},
                session_id=cdp.session_id,
            )
            logger.info(f"[{search_id}] Stealth JS injected via CDP")

            # Random delay to appear human-like
            await asyncio.sleep(random.uniform(1.0, 3.0))

            # ── Navigate to Kayak search URL ──
            _progress(1, f"Navigating to Kayak: {search_url}", url=search_url, goal="Load flight results")
            page = await browser.get_current_page()
            if not page:
                raise RuntimeError("BrowserSession has no current page after start()")

            await page.goto(search_url)
            logger.info(f"[{search_id}] Navigation started to Kayak search URL")

            # ── Wait for results to load ──
            _progress(2, "Waiting 15 seconds for Kayak to render flight results...", url=search_url, goal="Wait for results")
            await asyncio.sleep(15)

            final_url = page.url if hasattr(page, 'url') else search_url
            logger.info(f"[{search_id}] Page loaded — final URL: {final_url}")

            # ── Extract flight data via JavaScript ──
            _progress(3, "Extracting flight data from page DOM...", url=str(final_url), goal="Extract flights via JS")

            extraction_js = """
            () => {
                const cards = document.querySelectorAll('.nrc6-wrapper').length > 0
                    ? document.querySelectorAll('.nrc6-wrapper')
                    : document.querySelectorAll('.nrc6-inner').length > 0
                        ? document.querySelectorAll('.nrc6-inner')
                        : document.querySelectorAll('[aria-label*="Flight"]');

                if (cards.length > 0) {
                    const flights = [];
                    for (let i = 0; i < Math.min(cards.length, 20); i++) {
                        const text = cards[i].innerText;
                        if (text.match(/\\$\\d/) && text.match(/\\d+:\\d+/)) {
                            const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
                            flights.push({ raw_text: lines.join(' | ') });
                        }
                    }
                    if (flights.length > 0) return JSON.stringify(flights);
                }

                const main = document.querySelector('[role="main"], main, .resultsList');
                const container = main || document.body;
                return container.innerText.substring(0, 15000);
            }
            """

            raw_result = await page.evaluate(extraction_js)
            logger.info(f"[{search_id}] JS extraction returned {len(str(raw_result))} chars")

            # ── Parse extracted data ──
            _progress(4, f"Parsing extracted flight data ({len(str(raw_result))} chars)...", url=str(final_url), goal="Parse flight results")

            results: list[FlightResult] = []

            if raw_result:
                raw_str = str(raw_result)
                # Try JSON array first (from .nrc6-wrapper extraction)
                try:
                    cards_data = json.loads(raw_str)
                    if isinstance(cards_data, list):
                        for card in cards_data:
                            raw_text = card.get("raw_text", "") if isinstance(card, dict) else str(card)
                            parsed = _parse_raw_text_to_flight(raw_text)
                            if parsed:
                                results.append(parsed)
                        logger.info(f"[{search_id}] Parsed {len(results)} flights from JSON array")
                except (json.JSONDecodeError, TypeError):
                    # Not JSON — parse as raw page text
                    plain_results = _try_parse_plain_text_flights(raw_str)
                    if plain_results:
                        results = plain_results
                    logger.info(f"[{search_id}] Parsed {len(results)} flights from raw text")

            _progress(5, f"Done — found {len(results)} flights", url=str(final_url), goal="Complete")

            # ── Update search status ──
            if search_id in active_searches:
                active_searches[search_id].status = "completed"
                active_searches[search_id].results = results
            else:
                active_searches[search_id] = SearchStatus(
                    search_id=search_id, status="completed", results=results,
                )

            logger.info(f"[{search_id}] Search completed with {len(results)} results")
            await _notify_callback(search_id, "completed", results)

        except Exception as e:
            logger.error(f"[{search_id}] Search failed: {e}", exc_info=True)
            if search_id in active_searches:
                active_searches[search_id].status = "failed"
                active_searches[search_id].error = str(e)
            else:
                active_searches[search_id] = SearchStatus(
                    search_id=search_id, status="failed", error=str(e),
                )
            await _notify_callback(search_id, "failed", error=str(e))

        finally:
            try:
                if browser:
                    await browser.stop()
                    logger.info(f"[{search_id}] Browser session stopped")
            except Exception as stop_err:
                logger.warning(f"[{search_id}] Error stopping browser: {stop_err}")


@app.get("/status/{search_id}", response_model=SearchStatus)
async def get_search_status(search_id: str):
    """Get the status of an ongoing or completed search."""
    if search_id not in active_searches:
        raise HTTPException(status_code=404, detail=f"Search {search_id} not found")
    return active_searches[search_id]


@app.websocket("/ws/search/{search_id}")
async def ws_search(websocket: WebSocket, search_id: str):
    """
    WebSocket endpoint for streaming search progress events.

    Clients connect here to receive real-time updates for an already-running
    search (initiated via POST /search). The WS streams status from the
    in-memory active_searches store.
    """
    await websocket.accept()
    logger.info(f"WebSocket connected for search {search_id}")

    # Track how many progress events we've already sent so we only push new ones.
    sent_progress_count = 0

    try:
        # Send current status immediately
        if search_id in active_searches:
            status = active_searches[search_id]
            await websocket.send_json({
                "type": "status",
                "message": f"Search is {status.status}",
                "search_id": search_id,
            })

            # Catch up: send any progress events that occurred before WS connected
            for evt in status.progress:
                await _send_step_event(websocket, evt)
                sent_progress_count += 1

            # If already completed/failed, send final state and close
            if status.status == "completed":
                results = status.results or []
                await websocket.send_json({
                    "type": "done",
                    "message": "Search complete",
                    "results": [r.model_dump() for r in results],
                })
                return
            elif status.status == "failed":
                await websocket.send_json({
                    "type": "error",
                    "message": status.error or "Search failed",
                })
                return
        else:
            await websocket.send_json({
                "type": "status",
                "message": "Waiting for search to start...",
                "search_id": search_id,
            })

        # Stream events in real-time until search completes or client disconnects
        while True:
            await asyncio.sleep(10)  # check every 10s

            if search_id not in active_searches:
                await websocket.send_json({
                    "type": "status",
                    "message": "Waiting for search to start...",
                })
                continue

            status = active_searches[search_id]

            # Stream any new step events since last check
            progress = status.progress
            while sent_progress_count < len(progress):
                evt = progress[sent_progress_count]
                await _send_step_event(websocket, evt)
                sent_progress_count += 1

            if status.status == "completed":
                results = status.results or []
                await websocket.send_json({
                    "type": "done",
                    "message": "Search complete",
                    "results": [r.model_dump() for r in results],
                })
                break
            elif status.status == "failed":
                await websocket.send_json({
                    "type": "error",
                    "message": status.error or "Search failed",
                })
                break

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {search_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {search_id}: {e}")


async def _send_step_event(websocket: WebSocket, evt: dict) -> None:
    """Send a single step event over WebSocket with rich detail."""
    step = evt.get("step", "?")
    goal = evt.get("next_goal") or "Thinking..."
    url = evt.get("url") or ""
    title = evt.get("title") or ""
    thinking = evt.get("thinking") or ""
    evaluation = evt.get("evaluation") or ""
    memory = evt.get("memory") or ""
    actions = evt.get("actions") or []
    screenshot = evt.get("screenshot")  # base64 string or None

    # Build a human-readable summary
    message = f"Step {step}: {goal}"
    if url:
        message += f" — {url}"

    await websocket.send_json({
        "type": "progress",
        "message": message,
        "step": step,
        "url": url,
        "title": title,
        "thinking": thinking,
        "evaluation": evaluation,
        "memory": memory,
        "next_goal": goal,
        "actions": actions,
        "screenshot_url": f"data:image/png;base64,{screenshot}" if screenshot else None,
    })


def parse_flight_results(history: Any) -> list[FlightResult]:
    """
    Parse flight results from agent history.

    Attempts multiple extraction strategies:
    0. Structured output from output_model_schema (FlightResultsOutput)
    1. Structured output from agent's final_result() (string → JSON)
    2. All extracted_content from every step in history
    3. All action_results from every step
    4. Text scanning of model_actions for JSON
    5. Scan the "done" action text for JSON objects
    6. Parse raw_text objects from JavaScript evaluate output
    """
    results: list[FlightResult] = []

    # Strategy 0: Try structured output (from output_model_schema=FlightResultsOutput)
    try:
        if hasattr(history, "final_result") and callable(history.final_result):
            final = history.final_result()
            if final and isinstance(final, str):
                try:
                    data = json.loads(final)
                    if isinstance(data, dict) and "flights" in data:
                        flights_list = data["flights"]
                        if isinstance(flights_list, list):
                            for item in flights_list:
                                if isinstance(item, dict):
                                    try:
                                        normalized = _normalize_result_keys(item)
                                        if normalized.get("airline") and not str(normalized["airline"]).startswith("..."):
                                            results.append(FlightResult(**normalized))
                                    except Exception as e:
                                        logger.debug(f"Could not parse structured flight item: {e}")
                            if results:
                                logger.info(f"Parsed {len(results)} results from structured output (Strategy 0)")
                                return results
                except (json.JSONDecodeError, TypeError):
                    pass
    except Exception as e:
        logger.warning(f"Strategy 0 (structured output) failed: {e}")

    # Strategy 1: Try final_result() — returns a string with extracted_content
    try:
        if hasattr(history, "final_result") and callable(history.final_result):
            final = history.final_result()
            if final:
                logger.info(f"final_result() returned {len(str(final))} chars")
                parsed = _try_parse_flight_json(final)
                if parsed:
                    logger.info(f"Parsed {len(parsed)} results from final_result()")
                    return parsed
                else:
                    logger.warning(f"Could not parse final_result, trying other strategies")
    except Exception as e:
        logger.warning(f"Could not parse final_result: {e}")

    # Strategy 2: Scan ALL extracted_content from every step (newest first)
    if hasattr(history, "history"):
        try:
            for entry in reversed(history.history):
                if not hasattr(entry, "result") or not entry.result:
                    continue
                # entry.result is a list of ActionResult objects
                for action_result in reversed(entry.result):
                    content = getattr(action_result, "extracted_content", None)
                    if content:
                        parsed = _try_parse_flight_json(content)
                        if parsed:
                            logger.info(f"Parsed {len(parsed)} results from extracted_content")
                            return parsed
        except Exception as e:
            logger.warning(f"Strategy 2 (extracted_content scan) failed: {e}")

    # Strategy 3: Try action_results() method
    try:
        if hasattr(history, "action_results") and callable(history.action_results):
            for ar in reversed(history.action_results()):
                content = getattr(ar, "extracted_content", None)
                if content:
                    parsed = _try_parse_flight_json(content)
                    if parsed:
                        logger.info(f"Parsed {len(parsed)} results from action_results()")
                        return parsed
    except Exception as e:
        logger.warning(f"Strategy 3 (action_results) failed: {e}")

    # Strategy 4: Try model_actions for evaluate results
    if hasattr(history, "history"):
        try:
            for entry in reversed(history.history):
                if not hasattr(entry, "model_output") or not entry.model_output:
                    continue
                mo = entry.model_output
                if not hasattr(mo, "action"):
                    continue
                for act in reversed(mo.action):
                    act_dict = act.model_dump(exclude_none=True) if hasattr(act, "model_dump") else {}
                    # Check evaluate action results
                    for key in ("evaluate", "extract_content", "extract"):
                        if key in act_dict:
                            val = act_dict[key]
                            if isinstance(val, dict):
                                val = val.get("code", val.get("value", val.get("script", "")))
                            if isinstance(val, str):
                                parsed = _try_parse_flight_json(val)
                                if parsed:
                                    logger.info(f"Parsed {len(parsed)} results from {key} action")
                                    return parsed
        except Exception as e:
            logger.warning(f"Strategy 4 (model_actions) failed: {e}")

    # Strategy 5: Scan the "done" action text from model_output for JSON objects
    if hasattr(history, "history"):
        try:
            for entry in reversed(history.history):
                if not hasattr(entry, "model_output") or not entry.model_output:
                    continue
                mo = entry.model_output
                if not hasattr(mo, "action"):
                    continue
                for act in mo.action:
                    act_dict = act.model_dump(exclude_none=True) if hasattr(act, "model_dump") else {}
                    if "done" in act_dict:
                        done_val = act_dict["done"]
                        done_text = done_val.get("text", "") if isinstance(done_val, dict) else str(done_val)
                        if done_text:
                            parsed = _try_parse_flight_json(done_text)
                            if parsed:
                                logger.info(f"Parsed {len(parsed)} results from done action text")
                                return parsed
        except Exception as e:
            logger.warning(f"Strategy 5 (done action text) failed: {e}")

    # Strategy 6: Parse raw_text objects from JavaScript evaluate output
    # When the agent uses `evaluate` to run JS, the result comes back as
    # extracted_content in ActionResult. Try to parse raw_text arrays.
    if hasattr(history, "history"):
        try:
            for entry in reversed(history.history):
                if not hasattr(entry, "result") or not entry.result:
                    continue
                for action_result in reversed(entry.result):
                    content = getattr(action_result, "extracted_content", None)
                    if not content or not isinstance(content, str):
                        continue
                    # Try to parse as array of {raw_text: ...} objects
                    parsed_raw = _try_parse_raw_text_flights(content)
                    if parsed_raw:
                        logger.info(f"Parsed {len(parsed_raw)} results from raw_text JS output (Strategy 6)")
                        return parsed_raw
        except Exception as e:
            logger.warning(f"Strategy 6 (raw_text JS output) failed: {e}")

    logger.warning("No results could be parsed from agent history")
    return results


def _try_parse_flight_json(text: str) -> list[FlightResult] | None:
    """
    Try to parse flight results from a text string that may contain JSON.
    Handles malformed JSON common from LLM outputs:
      - Missing quotes around keys/values
      - Semicolons instead of colons
      - Smart quotes (e.g., „ " ")
      - Trailing spaces in values
      - Truncated arrays with ellipsis placeholders
      - Spaces in key names (e.g., "arrival _time")
    Returns a list of FlightResult if successful, None otherwise.
    """
    if not text or not isinstance(text, str):
        return None

    text = text.strip()

    # Pre-process: fix common LLM JSON errors
    cleaned = _fix_malformed_json(text)

    # Try direct JSON parse on cleaned text
    data = None
    try:
        data = json.loads(cleaned)
    except (json.JSONDecodeError, TypeError):
        pass

    # Try finding JSON array in the cleaned text (e.g., wrapped in markdown code blocks)
    if data is None:
        import re
        # Look for JSON arrays [...] in the text
        array_matches = re.findall(r'\[\s*\{.*?\}\s*\]', cleaned, re.DOTALL)
        for match in array_matches:
            try:
                data = json.loads(match)
                break
            except (json.JSONDecodeError, TypeError):
                continue

    # Fallback: try to extract individual JSON objects using regex
    if data is None:
        data = _extract_individual_objects(cleaned)

    if data is None:
        # Last resort: try the original text too
        try:
            data = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            pass

    if data is None:
        return None

    # Normalize data into a list of dicts
    items: list[dict] = []
    if isinstance(data, list):
        items = [item for item in data if isinstance(item, dict)]
    elif isinstance(data, dict):
        for key in ("flights", "results", "data"):
            if key in data and isinstance(data[key], list):
                items = [item for item in data[key] if isinstance(item, dict)]
                break
        if not items and ("airline" in data or "airline_name" in data):
            items = [data]

    if not items:
        return None

    # Try to parse each item as a FlightResult
    results: list[FlightResult] = []
    for item in items:
        try:
            normalized = _normalize_result_keys(item)
            # Skip placeholder/truncated entries
            if not normalized.get("airline") or normalized["airline"].startswith("..."):
                continue
            results.append(FlightResult(**normalized))
        except Exception as e:
            logger.debug(f"Could not parse flight item: {e} — item: {item}")
            continue

    return results if results else None


def _fix_malformed_json(text: str) -> str:
    """
    Fix common LLM JSON formatting errors to make the text parseable.
    """
    import re

    s = text

    # Replace smart/typographic quotes with standard quotes
    s = s.replace('\u201e', '"')  # „
    s = s.replace('\u201c', '"')  # "
    s = s.replace('\u201d', '"')  # "
    s = s.replace('\u2018', "'")  # '
    s = s.replace('\u2019', "'")  # '

    # Remove truncated placeholder entries like { ... (remaining ...) ... }
    s = re.sub(r'\{[^{}]*\.\.\.[^{}]*\}', '', s)

    # Remove trailing commas before ] or }
    s = re.sub(r',\s*([}\]])', r'\1', s)

    # Fix spaces in key names like "arrival _time": → "arrival_time":
    # Only target keys (followed by a colon) to avoid corrupting values like "Aer Lingus"
    s = re.sub(r'"(\w+)\s+(\w+)"\s*:', lambda m: f'"{m.group(1)}_{m.group(2)}":', s)
    # Also fix unquoted keys with spaces: arrival _time → arrival_time
    s = re.sub(r'(\w+)\s+_(\w+)\s*:', r'"\1_\2":', s)
    s = re.sub(r'(\w+)_\s+(\w+)\s*:', r'"\1_\2":', s)

    # Fix missing quotes around keys: {airline: → {"airline":
    # Match word chars (possibly with underscores) followed by colon, not already quoted
    s = re.sub(r'(?<=[{,\s])(\w[\w_]*)\s*:', r'"\1":', s)

    # Fix semicolons used as colons in values: "8;25am" → "8:25am"
    # But don't replace : that separates key from value — target only inside quoted strings
    def fix_semicolons_in_values(m: re.Match) -> str:
        return m.group(0).replace(';', ':')
    s = re.sub(r'"[^"]*;[^"]*"', fix_semicolons_in_values, s)

    # Fix missing quotes around string values: :"Finnair " → : "Finnair"
    # This handles cases like "airline":"Finnair " (with trailing space)
    # Strip trailing spaces inside quoted values
    def strip_value_spaces(m: re.Match) -> str:
        return f'"{m.group(1).strip()}"'
    s = re.sub(r'"([^"]*\S)\s+"', strip_value_spaces, s)

    # Fix unquoted string values after colon: :"Finnair" is fine, but :Finnair needs quotes
    # Handle :null, :true, :false, :digits as non-string
    s = re.sub(
        r':\s*(?!")(?!null|true|false|\d)([A-Za-z][A-Za-z0-9\s+:]*?)(?=\s*[,}\]])',
        lambda m: f': "{m.group(1).strip()}"',
        s,
    )

    return s


def _extract_individual_objects(text: str) -> list[dict] | None:
    """
    Try to extract individual JSON objects from text, even if the array is malformed.
    Parses each {…} block independently.
    """
    import re

    # Find all { ... } blocks
    objects = []
    depth = 0
    start = -1
    for i, ch in enumerate(text):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start >= 0:
                block = text[start:i + 1]
                try:
                    obj = json.loads(block)
                    if isinstance(obj, dict) and ("airline" in obj or "airline_name" in obj
                                                   or "departure_time" in obj or "price" in obj):
                        objects.append(obj)
                except (json.JSONDecodeError, TypeError):
                    # Try fixing the individual block
                    fixed = _fix_malformed_json(block)
                    try:
                        obj = json.loads(fixed)
                        if isinstance(obj, dict):
                            objects.append(obj)
                    except (json.JSONDecodeError, TypeError):
                        continue
                start = -1

    return objects if objects else None


def _normalize_result_keys(data: dict) -> dict:
    """Normalize various key formats to match FlightResult model fields.

    Handles multiple naming conventions the LLM may use:
    - camelCase: departureTime, arrivalTime, flightUrl
    - descriptive: airline_name, total_duration, number_of_stops, currency_code
    - abbreviated: departure, arrival
    - with spaces: "arrival _time" (already fixed in _fix_malformed_json)
    """
    mapping = {
        # Standard camelCase
        "departureTime": "departure_time",
        "arrivalTime": "arrival_time",
        "flightUrl": "flight_url",
        # Abbreviated
        "departure": "departure_time",
        "arrival": "arrival_time",
        "url": "flight_url",
        "bookingUrl": "flight_url",
        # Descriptive (GPT often uses these)
        "airline_name": "airline",
        "airlineName": "airline",
        "total_duration": "duration",
        "totalDuration": "duration",
        "flight_duration": "duration",
        "flightDuration": "duration",
        "number_of_stops": "stops",
        "numberOfStops": "stops",
        "numStops": "stops",
        "num_stops": "stops",
        "stop_count": "stops",
        "currency_code": "currency",
        "currencyCode": "currency",
        "booking_link_url": "flight_url",
        "bookingLinkUrl": "flight_url",
        "booking_url": "flight_url",
        "booking_link": "flight_url",
        "nonstop": None,  # handle separately
    }

    normalized = {}
    for key, value in data.items():
        mapped_key = mapping.get(key, key)
        if mapped_key is not None:
            # Strip whitespace from string values
            if isinstance(value, str):
                value = value.strip()
            normalized[mapped_key] = value

    # Handle "nonstop" boolean → stops=0
    if "nonstop" in data and data["nonstop"] and "stops" not in normalized:
        normalized["stops"] = 0

    # Ensure stops defaults to 0
    if "stops" not in normalized:
        normalized["stops"] = 0

    # Handle stops as string (e.g., "0", "1 stop", "nonstop")
    if isinstance(normalized.get("stops"), str):
        stops_str = normalized["stops"].lower().strip()
        if "nonstop" in stops_str or "non-stop" in stops_str or "direct" in stops_str:
            normalized["stops"] = 0
        else:
            import re
            m = re.search(r'(\d+)', stops_str)
            normalized["stops"] = int(m.group(1)) if m else 0

    # Ensure currency defaults to USD
    if "currency" not in normalized:
        normalized["currency"] = "USD"

    # Handle price as string (e.g., "$522", "522 USD")
    if isinstance(normalized.get("price"), str):
        import re
        price_str = normalized["price"]
        m = re.search(r'[\d,]+\.?\d*', price_str.replace(',', ''))
        if m:
            normalized["price"] = float(m.group(0))
        else:
            normalized["price"] = 0.0

    return normalized


def _try_parse_raw_text_flights(text: str) -> list[FlightResult] | None:
    """
    Parse flight results from raw_text objects produced by JavaScript evaluation.

    The JS in the prompt extracts each flight card's innerText as a single
    pipe-delimited string like:
      "6:25 PM | 9:05 AM+1 | 9h 40m | 1 stop | FRA | Aer Lingus | $522"

    This function parses those text blobs into structured FlightResult objects.
    """
    import re

    if not text or not isinstance(text, str):
        return None

    text = text.strip()

    # Try parsing as JSON array of {raw_text: ...} objects
    data = None
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        # Try extracting JSON from the text (may be wrapped in other output)
        array_matches = re.findall(r'\[\s*\{.*?\}\s*\]', text, re.DOTALL)
        for match in array_matches:
            try:
                data = json.loads(match)
                break
            except (json.JSONDecodeError, TypeError):
                continue

    if not data or not isinstance(data, list):
        # Try to parse as plain text with flight info per line
        return _try_parse_plain_text_flights(text)

    results: list[FlightResult] = []
    for item in data:
        if not isinstance(item, dict):
            continue

        raw = item.get("raw_text", "")
        if not raw:
            continue

        flight = _parse_raw_text_to_flight(raw)
        if flight:
            results.append(flight)

    return results if results else None


def _parse_raw_text_to_flight(raw_text: str) -> FlightResult | None:
    """
    Parse a single raw text blob (pipe-delimited or newline-joined
    flight card text) into a FlightResult.

    Applies heuristic patterns to identify:
    - Times (e.g., "6:25 PM", "9:05 AM+1")
    - Duration (e.g., "9h 40m", "7h 30m")
    - Stops (e.g., "nonstop", "1 stop", "2 stops")
    - Price (e.g., "$522", "€450")
    - Airline (remaining text after extracting the above)
    """
    import re

    if not raw_text:
        return None

    text = raw_text.strip()

    # Extract price — $NNN or NNN USD/EUR
    price_match = re.search(r'[\$€£]\s*([\d,]+(?:\.\d{2})?)', text)
    if not price_match:
        price_match = re.search(r'([\d,]+(?:\.\d{2})?)\s*(?:USD|EUR|GBP)', text)
    if not price_match:
        return None  # No price = not a valid flight entry

    price = float(price_match.group(1).replace(',', ''))

    # Detect currency
    currency = "USD"
    if '€' in text:
        currency = "EUR"
    elif '£' in text:
        currency = "GBP"

    # Extract times — HH:MM AM/PM pattern
    time_pattern = r'(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)(?:\s*\+\d)?)'
    times = re.findall(time_pattern, text, re.IGNORECASE)
    departure_time = times[0].strip() if len(times) >= 1 else "N/A"
    arrival_time = times[1].strip() if len(times) >= 2 else "N/A"

    # Extract duration — "Xh Ym" or "Xh" or "Xhr Ymin" or "X hr Y min"
    # Use finditer to skip layover durations (e.g. "1h 30m layover, Shannon")
    duration = "N/A"
    for dm in re.finditer(r'(\d+)\s*h(?:r|rs|ours?)?\s*(?:(\d+)\s*m(?:in)?)?', text, re.IGNORECASE):
        # Check if "layover" follows this duration — if so, skip it
        after_text = text[dm.end():dm.end() + 30]
        if re.match(r'\s*layover', after_text, re.IGNORECASE):
            continue
        hours = dm.group(1)
        mins = dm.group(2)
        duration = f"{hours}h" + (f" {mins}m" if mins else "")
        break
    if duration == "N/A":
        # Try "X hours Y minutes" format
        duration_match2 = re.search(r'(\d+)\s*hours?\s*(?:(\d+)\s*min(?:ute)?s?)?', text, re.IGNORECASE)
        if duration_match2:
            hours = duration_match2.group(1)
            mins = duration_match2.group(2)
            duration = f"{hours}h" + (f" {mins}m" if mins else "")

    # Extract stops
    stops = 0
    stops_match = re.search(r'(\d+)\s*stop', text, re.IGNORECASE)
    if stops_match:
        stops = int(stops_match.group(1))
    elif re.search(r'non\s*stop|direct', text, re.IGNORECASE):
        stops = 0

    # Extract airline — try to identify by removing known patterns
    # Split by pipe if pipe-delimited
    parts = [p.strip() for p in text.split('|')] if '|' in text else [p.strip() for p in text.split('\n')]
    airline = "Unknown"
    # The airline is usually a named segment that doesn't match time/price/duration/stops patterns
    for part in parts:
        part_clean = part.strip()
        if not part_clean:
            continue
        # Skip if it looks like a time, price, duration, stops, or airport code
        if re.match(r'^\d{1,2}:\d{2}', part_clean):
            continue
        if re.match(r'^[\$€£]', part_clean):
            continue
        if re.match(r'^\d+\s*h', part_clean, re.IGNORECASE):
            continue
        if re.match(r'^\d+\s*stop', part_clean, re.IGNORECASE):
            continue
        if re.match(r'^(nonstop|non-stop|direct)\b', part_clean, re.IGNORECASE):
            continue
        if re.match(r'^[A-Z]{3}$', part_clean):  # airport code
            continue
        if re.match(r'^[A-Z]{3}\s*[\u2013\u2014–-]\s*[A-Z]{3}$', part_clean):  # route like JFK–LHR
            continue
        if re.match(r'^\d+$', part_clean):  # bare number
            continue
        if re.match(r'^(Show more|Sponsored|Ad|round trip|one way|Track prices?)\b', part_clean, re.IGNORECASE):
            continue
        if re.match(r'^(Separate tickets|Self transfer|Checked bag|Carry-on)\b', part_clean, re.IGNORECASE):
            continue
        # Skip Kayak card UI elements (buttons, fare classes, labels)
        if re.match(r'^(Save|Share|Select|Saver|Basic|Main|Comfort|View Deal)\b', part_clean, re.IGNORECASE):
            continue
        if part_clean == '-':  # dash separator between airports
            continue
        if re.search(r'layover', part_clean, re.IGNORECASE):  # e.g. "1h 30m layover, Shannon"
            continue
        if re.match(r'^(Go to|Book|Details|Price)\b', part_clean, re.IGNORECASE):
            continue
        # Skip time ranges with dash/en-dash (e.g. "6:25 pm – 9:05 am+1")
        if re.search(r'\d+:\d+.*[–\-]\s*\d+:\d+', part_clean):
            continue
        # Skip generic marketing/page text (too long to be an airline name)
        if len(part_clean) > 50:
            continue
        # Skip text that contains common non-airline words
        if re.search(r'\b(search|compare|find|cheap|deal|site|book now|travel|hundred|click|browse|explore)\b', part_clean, re.IGNORECASE):
            continue
        # This is likely an airline name
        if len(part_clean) >= 3:
            airline = part_clean
            break

    # Final validation: reject entries that look like marketing text
    # A real flight airline name is typically under 40 chars (e.g. "British Airways")
    if airline == "Unknown" or len(airline) > 40:
        return None

    try:
        return FlightResult(
            airline=airline,
            departure_time=departure_time,
            arrival_time=arrival_time,
            duration=duration,
            stops=stops,
            price=price,
            currency=currency,
            flight_url=None,
        )
    except Exception:
        return None


def _try_parse_plain_text_flights(text: str) -> list[FlightResult] | None:
    """
    Last-resort parser: scan plain text for flight-like patterns.
    Looks for lines/blocks containing a price ($NNN) and time patterns,
    then tries to extract individual flights from surrounding context.

    Handles both double-newline-separated blocks (Kayak) and
    Google Flights style where results are in consecutive lines.
    """
    import re

    if not text or len(text) < 20:
        return None

    results: list[FlightResult] = []

    # Strategy A: Split text into chunks by double newlines
    chunks = re.split(r'\n{2,}|\r\n{2,}', text)

    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        # Must contain a price to be a valid flight chunk
        if not re.search(r'[\$€£]\s*\d', chunk):
            continue
        flight = _parse_raw_text_to_flight(chunk)
        if flight and flight.price > 0:
            results.append(flight)

    if results:
        return results

    # Strategy B: Google Flights style — scan for price patterns and grab
    # surrounding lines as context for each flight
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # Look for a price marker
        if re.search(r'[\$€£]\s*\d', line):
            # Grab context: up to 8 lines before and 2 after the price line
            start = max(0, i - 8)
            end = min(len(lines), i + 3)
            context_block = '\n'.join(lines[start:end])
            flight = _parse_raw_text_to_flight(context_block)
            if flight and flight.price > 0:
                results.append(flight)
                i = end  # Skip past this block
                continue
        i += 1

    return results if results else None
