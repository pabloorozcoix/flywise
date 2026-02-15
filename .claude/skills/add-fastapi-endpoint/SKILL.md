---
name: add-fastapi-endpoint
description: Create a new FastAPI endpoint in the browser-use service following project conventions. Use when adding REST or WebSocket endpoints to the Python browser automation service.
argument-hint: "[method /path e.g. POST /search or GET /health]"
---

Add a new FastAPI endpoint to the browser-use service using its **layered architecture**.

## Architecture

The service uses a layered pattern — create files in the correct layer:

```
browser-service/app/
├── routes/          # API layer — thin controllers (add new route file here)
│   └── __init__.py  # Register new router via include_router()
├── services/        # Business logic (add orchestration here)
├── models/          # Pydantic models (add request/response types here)
│   ├── requests.py  # Request bodies
│   ├── responses.py # Response models
│   ├── domain.py    # Core domain objects
│   └── enums.py     # String enums
├── parsers/         # Pure extraction logic
├── prompts/         # Prompt template functions
└── constants/       # Static data modules
```

## Conventions

- Python 3.12, `async def` for all handlers
- Modern typing: `str | None`, `list[...]`, `from __future__ import annotations`
- Absolute imports: `from app.models.domain import FlightResult`
- Logging: `from app.logger import get_logger` then `logger = get_logger("routes.my_route")`
- Pydantic `BaseModel` with `Field()` for all request/response validation
- Enums: `(str, Enum)` dual inheritance
- browser-use native imports: `from browser_use import Agent, Browser`
- LLM: `ChatOllama(host="http://ollama:11434")` — native, **NOT** langchain
- Browser: `Browser(headless=True)` — uses system Chromium, **NO** `playwright install`
- Module-level docstrings on every file (Google/Sphinx style)

## REST Route Template

Create `browser-service/app/routes/my_route.py`:

```python
"""My route — description of what this endpoint does."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.logger import get_logger
from app.models.requests import MyRequest
from app.models.responses import MyResponse

logger = get_logger("routes.my_route")

router = APIRouter(tags=["my-domain"])


@router.post("/my-endpoint", response_model=MyResponse)
async def my_endpoint(request: MyRequest) -> MyResponse:
    """Handle my endpoint request.

    Args:
        request: Validated request body.

    Returns:
        MyResponse with result data.
    """
    try:
        # Delegate to service layer
        result = await my_service.do_work(request)
        return MyResponse(data=result)
    except Exception as e:
        logger.error(f"Error in /my-endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

## Register the Router

In `browser-service/app/routes/__init__.py`, add:

```python
from app.routes.my_route import router as my_route_router

api_router.include_router(my_route_router)
```

## WebSocket Route Template

```python
"""WebSocket endpoint for streaming progress."""

from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.logger import get_logger

logger = get_logger("routes.my_ws")

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/my-endpoint/{id}")
async def ws_my_endpoint(websocket: WebSocket, id: str) -> None:
    await websocket.accept()
    try:
        await websocket.send_json({"type": "progress", "message": "Starting..."})
        # ... do work ...
        await websocket.send_json({"type": "done", "data": result})
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {id}")
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
```

## After Creating

1. Add Pydantic models to the appropriate file in `app/models/`
2. Register the router in `app/routes/__init__.py`
3. Add any new pip dependencies to `requirements.txt`
4. Verify: `make dev-build` then `curl http://localhost:8000/my-endpoint`
