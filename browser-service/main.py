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
from prompts import build_flight_search_prompt

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

# Next.js callback URL for persisting results
NEXTJS_CALLBACK_URL = os.getenv(
    "NEXTJS_CALLBACK_URL", "http://nextjs:3000/api/callback/search-complete"
)

# Maximum concurrent searches (rate limiting)
MAX_CONCURRENT_SEARCHES = int(os.getenv("MAX_CONCURRENT_SEARCHES", "3"))
_search_semaphore = asyncio.Semaphore(MAX_CONCURRENT_SEARCHES)

# Stealth user agents for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]


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
    """Background task that runs the browser-use agent for a flight search."""
    async with _search_semaphore:
        try:
            from browser_use import Agent, Browser

            # Build the search prompt using the prompt template
            task = build_flight_search_prompt(
                origin=request.origin,
                destination=request.destination,
                departure_date=request.departure_date,
                return_date=request.return_date,
                cabin_class=request.cabin_class,
                direct_only=request.direct_only,
            )

            # ── Determine which LLM provider to use ──
            use_openai = bool(request.openai_api_key)
            active_model = OPENAI_MODEL if use_openai else OLLAMA_MODEL

            # ── Add an initial progress event so the frontend sees activity ──
            if search_id in active_searches:
                provider_label = "OpenAI" if use_openai else "Ollama"
                active_searches[search_id].progress.append({
                    "step": 0,
                    "url": None,
                    "title": None,
                    "thinking": f"Initializing browser and loading model {active_model} ({provider_label})...",
                    "evaluation": None,
                    "memory": None,
                    "next_goal": "Setting up browser and LLM",
                    "actions": [],
                    "screenshot": None,
                })

            # Create browser with stealth settings
            stealth_config = _get_stealth_browser_config()
            browser = Browser(**stealth_config)
            logger.info(f"[{search_id}] Browser created with stealth config")

            # ── Create LLM instance based on provider ──
            llm_timeout = int(os.getenv("LLM_TIMEOUT", "600"))

            if use_openai:
                from browser_use.llm.openai.chat import ChatOpenAI

                llm = ChatOpenAI(
                    model=OPENAI_MODEL,
                    api_key=request.openai_api_key,
                    timeout=float(llm_timeout),
                )
                logger.info(f"[{search_id}] LLM configured: {OPENAI_MODEL} via OpenAI (timeout={llm_timeout}s)")
            else:
                from browser_use import ChatOllama

                llm = ChatOllama(
                    model=OLLAMA_MODEL,
                    host=OLLAMA_HOST,
                    timeout=llm_timeout,
                )
                logger.info(f"[{search_id}] LLM configured: {OLLAMA_MODEL} @ {OLLAMA_HOST} (timeout={llm_timeout}s)")

            # Random delay to appear more human-like
            await asyncio.sleep(random.uniform(1.0, 3.0))

            # ── Step callback — captures each agent step for real-time WS streaming ──
            def on_step(browser_state, agent_output, step_number):
                """Called by browser-use Agent on every step."""
                # Build a concise event dict from the agent's output
                actions_desc = []
                if agent_output.action:
                    for act in agent_output.action:
                        # ActionModel has a model_dump() method
                        try:
                            act_dict = act.model_dump(exclude_none=True)
                            actions_desc.append(act_dict)
                        except Exception:
                            actions_desc.append(str(act))

                has_screenshot = bool(browser_state and browser_state.screenshot)
                event = {
                    "step": step_number,
                    "url": browser_state.url if browser_state else None,
                    "title": browser_state.title if browser_state else None,
                    "thinking": agent_output.thinking,
                    "evaluation": agent_output.evaluation_previous_goal,
                    "memory": agent_output.memory,
                    "next_goal": agent_output.next_goal,
                    "actions": actions_desc,
                    "screenshot": browser_state.screenshot if browser_state else None,
                }

                # Append to the progress list (thread-safe for asyncio — single-threaded loop)
                if search_id in active_searches:
                    active_searches[search_id].progress.append(event)

                # Build a human-readable summary for the log
                goal = agent_output.next_goal or "thinking..."
                url = browser_state.url if browser_state else "unknown"
                logger.info(
                    f"[{search_id}] Step {step_number}: {goal} (at {url}) "
                    f"[screenshot={'yes' if has_screenshot else 'no'}]"
                )

            # Create and run the agent with step callbacks
            agent = Agent(
                task=task,
                llm=llm,
                browser=browser,
                max_failures=5,
                generate_gif=False,
                llm_timeout=llm_timeout,
                step_timeout=llm_timeout,
                register_new_step_callback=on_step,
            )

            logger.info(f"[{search_id}] Running agent with model {active_model}")
            history = await agent.run(max_steps=20)

            # Parse results from agent history
            results = parse_flight_results(history)

            # Update search status — MUTATE instead of replace to preserve progress events
            if search_id in active_searches:
                active_searches[search_id].status = "completed"
                active_searches[search_id].results = results
            else:
                active_searches[search_id] = SearchStatus(
                    search_id=search_id,
                    status="completed",
                    results=results,
                )

            logger.info(f"[{search_id}] Search completed with {len(results)} results")

            # Notify Next.js to persist results to the database
            await _notify_callback(search_id, "completed", results)

        except Exception as e:
            logger.error(f"[{search_id}] Search failed: {e}", exc_info=True)
            # MUTATE instead of replace to preserve progress events
            if search_id in active_searches:
                active_searches[search_id].status = "failed"
                active_searches[search_id].error = str(e)
            else:
                active_searches[search_id] = SearchStatus(
                    search_id=search_id,
                    status="failed",
                    error=str(e),
                )

            # Notify Next.js about the failure
            await _notify_callback(search_id, "failed", error=str(e))


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
    1. Structured output from agent's final_result() (string → JSON)
    2. All extracted_content from every step in history
    3. All action_results from every step
    4. Text scanning of all step results for JSON arrays
    5. Scan ALL text output from history for JSON-like flight objects
    """
    results: list[FlightResult] = []

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
                                val = val.get("code", val.get("value", ""))
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

    # Fix spaces in key names like "arrival _time" → "arrival_time"
    s = re.sub(r'"(\w+)\s+(\w+)"', lambda m: f'"{m.group(1)}_{m.group(2)}"' if '_' not in m.group(0) else f'"{m.group(1)}{m.group(2)}"', s)
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
