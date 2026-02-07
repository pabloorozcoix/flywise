"""Browser-Use FastAPI Service — HTTP wrapper around browser-use library."""

import logging
import os
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from models import (
    FlightSearchRequest,
    FlightSearchResponse,
    FlightResult,
    HealthResponse,
    SearchStatus,
)

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

# Ollama host from environment
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(status="ok")


@app.post("/search", response_model=FlightSearchResponse)
async def search_flights(request: FlightSearchRequest):
    """
    Initiate a flight search using browser-use agent.

    Creates a Browser instance with headless Chromium, configures ChatOllama
    to use the local Ollama service, and runs an Agent to navigate Google Flights
    and extract flight results.
    """
    search_id = str(uuid.uuid4())
    logger.info(f"Starting flight search {search_id}: {request.origin} → {request.destination}")

    # Track search status
    active_searches[search_id] = SearchStatus(
        search_id=search_id,
        status="running",
    )

    try:
        from browser_use import Agent, Browser
        from browser_use import ChatOllama

        # Build the search prompt
        task = _build_search_task(request)

        # Create browser and LLM instances
        browser = Browser(headless=True)
        llm = ChatOllama(
            model="gpt-oss:20b",
            host=OLLAMA_HOST,
        )

        # Create and run the agent
        agent = Agent(
            task=task,
            llm=llm,
            browser=browser,
            max_failures=3,
        )

        logger.info(f"Running agent for search {search_id}")
        history = await agent.run()

        # Parse results from agent history
        results = _parse_flight_results(history)

        # Update search status
        active_searches[search_id] = SearchStatus(
            search_id=search_id,
            status="completed",
            results=results,
        )

        logger.info(f"Search {search_id} completed with {len(results)} results")

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

    Clients connect here to receive real-time updates as the browser-use agent
    navigates Google Flights and extracts results.
    """
    await websocket.accept()
    logger.info(f"WebSocket connected for search {search_id}")

    try:
        # Wait for search parameters from the client
        data = await websocket.receive_json()
        request = FlightSearchRequest(**data)

        # Track search
        active_searches[search_id] = SearchStatus(
            search_id=search_id,
            status="running",
        )

        await websocket.send_json({
            "type": "status",
            "message": "Search started",
            "search_id": search_id,
        })

        try:
            from browser_use import Agent, Browser
            from browser_use import ChatOllama

            task = _build_search_task(request)

            browser = Browser(headless=True)
            llm = ChatOllama(
                model="gpt-oss:20b",
                host=OLLAMA_HOST,
            )

            await websocket.send_json({
                "type": "progress",
                "message": "Browser initialized, starting agent...",
            })

            # Define step callback to stream progress
            async def on_step(step_info: Any) -> None:
                step_msg = str(step_info) if step_info else "Agent working..."
                await websocket.send_json({
                    "type": "progress",
                    "message": step_msg,
                })

            agent = Agent(
                task=task,
                llm=llm,
                browser=browser,
                max_failures=3,
            )

            history = await agent.run()
            results = _parse_flight_results(history)

            active_searches[search_id] = SearchStatus(
                search_id=search_id,
                status="completed",
                results=results,
            )

            await websocket.send_json({
                "type": "done",
                "message": "Search complete",
                "results": [r.model_dump() for r in results],
            })

        except Exception as e:
            logger.error(f"WebSocket search {search_id} failed: {e}")
            active_searches[search_id] = SearchStatus(
                search_id=search_id,
                status="failed",
                error=str(e),
            )
            await websocket.send_json({
                "type": "error",
                "message": str(e),
            })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {search_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {search_id}: {e}")


def _build_search_task(request: FlightSearchRequest) -> str:
    """Build the agent task prompt for Google Flights search."""
    task = (
        f"Go to https://www.google.com/travel/flights and search for flights "
        f"from {request.origin} to {request.destination} "
        f"departing on {request.departure_date.isoformat()}"
    )
    if request.return_date:
        task += f" returning on {request.return_date.isoformat()}"
    else:
        task += " (one-way)"

    if request.cabin_class != "economy":
        task += f", cabin class: {request.cabin_class}"

    if request.direct_only:
        task += ", non-stop flights only"

    task += (
        ". Extract all visible flight results including: "
        "airline name, departure time, arrival time, duration, "
        "number of stops, and price. "
        "Return the results as structured JSON."
    )
    return task


def _parse_flight_results(history: Any) -> list[FlightResult]:
    """Parse flight results from agent history."""
    results: list[FlightResult] = []

    try:
        # Attempt to extract structured data from the agent's final response
        if hasattr(history, "final_result") and history.final_result:
            final = history.final_result()
            if isinstance(final, list):
                for item in final:
                    if isinstance(item, dict):
                        results.append(FlightResult(**item))
            elif isinstance(final, dict) and "results" in final:
                for item in final["results"]:
                    if isinstance(item, dict):
                        results.append(FlightResult(**item))
    except Exception as e:
        logger.warning(f"Could not parse structured results: {e}")

    # Fallback: try to extract from the last history entry
    if not results and hasattr(history, "history"):
        try:
            for entry in reversed(history.history):
                if hasattr(entry, "result") and entry.result:
                    import json
                    data = json.loads(str(entry.result))
                    if isinstance(data, list):
                        for item in data:
                            results.append(FlightResult(**item))
                        break
                    elif isinstance(data, dict) and "results" in data:
                        for item in data["results"]:
                            results.append(FlightResult(**item))
                        break
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Fallback parsing failed: {e}")

    return results
