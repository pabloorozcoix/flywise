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
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gpt-oss:20b")

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

    Creates a Browser instance with headless Chromium, configures ChatOllama
    to use the local Ollama service, and runs an Agent to navigate Google Flights
    and extract flight results.
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

    async with _search_semaphore:
        try:
            from browser_use import Agent, Browser
            from browser_use import ChatOllama

            # Build the search prompt using the prompt template
            task = build_flight_search_prompt(
                origin=request.origin,
                destination=request.destination,
                departure_date=request.departure_date,
                return_date=request.return_date,
                cabin_class=request.cabin_class,
                direct_only=request.direct_only,
            )

            # Create browser with stealth settings and LLM instances
            stealth_config = _get_stealth_browser_config()
            browser = Browser(**stealth_config)

            # Increase timeout for CPU inference with large models
            llm_timeout = int(os.getenv("LLM_TIMEOUT", "600"))
            llm = ChatOllama(
                model=OLLAMA_MODEL,
                host=OLLAMA_HOST,
                timeout=llm_timeout,
            )

            # Random delay to appear more human-like
            await asyncio.sleep(random.uniform(1.0, 3.0))

            # Create and run the agent with structured output
            agent = Agent(
                task=task,
                llm=llm,
                browser=browser,
                max_failures=5,
                generate_gif=False,
                llm_timeout=llm_timeout,
                step_timeout=llm_timeout,
            )

            logger.info(f"Running agent for search {search_id} with model {OLLAMA_MODEL}")
            history = await agent.run()

            # Parse results from agent history
            results = parse_flight_results(history)

            # Update search status
            active_searches[search_id] = SearchStatus(
                search_id=search_id,
                status="completed",
                results=results,
            )

            logger.info(f"Search {search_id} completed with {len(results)} results")

            # Notify Next.js to persist results to the database
            await _notify_callback(search_id, "completed", results)

            return FlightSearchResponse(
                search_id=search_id,
                status="completed",
                results=results,
            )

        except Exception as e:
            logger.error(f"Search {search_id} failed: {e}")
            active_searches[search_id] = SearchStatus(
                search_id=search_id,
                status="failed",
                error=str(e),
            )

            # Notify Next.js about the failure
            await _notify_callback(search_id, "failed", error=str(e))

            raise HTTPException(status_code=500, detail=str(e))


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

    try:
        # Send current status immediately
        if search_id in active_searches:
            status = active_searches[search_id]
            await websocket.send_json({
                "type": "status",
                "message": f"Search is {status.status}",
                "search_id": search_id,
            })

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

        # Poll until search completes or client disconnects
        while True:
            await asyncio.sleep(2)

            if search_id not in active_searches:
                await websocket.send_json({
                    "type": "status",
                    "message": "Waiting for search to start...",
                })
                continue

            status = active_searches[search_id]

            if status.status == "running":
                await websocket.send_json({
                    "type": "progress",
                    "message": "Agent is navigating and searching for flights...",
                })
            elif status.status == "completed":
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


def parse_flight_results(history: Any) -> list[FlightResult]:
    """
    Parse flight results from agent history.

    Attempts multiple extraction strategies:
    1. Structured output from agent's final_result()
    2. FlightResultsOutput schema parsing
    3. JSON from the last history entry
    4. Text-based extraction fallback
    """
    results: list[FlightResult] = []

    # Strategy 1: Try final_result() for structured output
    try:
        if hasattr(history, "final_result") and history.final_result:
            final = history.final_result()

            # Check if it's a FlightResultsOutput
            if isinstance(final, dict) and "flights" in final:
                for item in final["flights"]:
                    if isinstance(item, dict):
                        results.append(FlightResult(**item))
                if results:
                    logger.info(f"Parsed {len(results)} results from FlightResultsOutput")
                    return results

            # Direct list of results
            if isinstance(final, list):
                for item in final:
                    if isinstance(item, dict):
                        results.append(FlightResult(**_normalize_result_keys(item)))
                if results:
                    logger.info(f"Parsed {len(results)} results from final_result list")
                    return results

            # Results nested under a key
            if isinstance(final, dict) and "results" in final:
                for item in final["results"]:
                    if isinstance(item, dict):
                        results.append(FlightResult(**_normalize_result_keys(item)))
                if results:
                    logger.info(f"Parsed {len(results)} results from final_result dict")
                    return results
    except Exception as e:
        logger.warning(f"Could not parse structured results: {e}")

    # Strategy 2: Parse from history entries
    if not results and hasattr(history, "history"):
        try:
            for entry in reversed(history.history):
                if hasattr(entry, "result") and entry.result:
                    try:
                        data = json.loads(str(entry.result))
                    except (json.JSONDecodeError, TypeError):
                        continue

                    items = []
                    if isinstance(data, list):
                        items = data
                    elif isinstance(data, dict):
                        if "flights" in data:
                            items = data["flights"]
                        elif "results" in data:
                            items = data["results"]

                    for item in items:
                        if isinstance(item, dict):
                            try:
                                results.append(FlightResult(**_normalize_result_keys(item)))
                            except Exception:
                                continue

                    if results:
                        logger.info(f"Parsed {len(results)} results from history entries")
                        return results
        except Exception as e:
            logger.warning(f"Fallback parsing failed: {e}")

    logger.warning("No results could be parsed from agent history")
    return results


def _normalize_result_keys(data: dict) -> dict:
    """Normalize various key formats to match FlightResult model fields."""
    mapping = {
        "departureTime": "departure_time",
        "departure": "departure_time",
        "arrivalTime": "arrival_time",
        "arrival": "arrival_time",
        "flightUrl": "flight_url",
        "url": "flight_url",
        "bookingUrl": "flight_url",
        "numStops": "stops",
        "numberOfStops": "stops",
        "nonstop": None,  # handle separately
    }

    normalized = {}
    for key, value in data.items():
        mapped_key = mapping.get(key, key)
        if mapped_key is not None:
            normalized[mapped_key] = value

    # Handle "nonstop" boolean → stops=0
    if "nonstop" in data and data["nonstop"] and "stops" not in normalized:
        normalized["stops"] = 0

    # Ensure stops defaults to 0
    if "stops" not in normalized:
        normalized["stops"] = 0

    # Ensure currency defaults to USD
    if "currency" not in normalized:
        normalized["currency"] = "USD"

    return normalized
