---
name: add-fastapi-endpoint
description: Create a new FastAPI endpoint in the browser-use service following project conventions. Use when adding REST or WebSocket endpoints to the Python browser automation service.
argument-hint: "[method /path e.g. POST /search or GET /health]"
---

Add a new FastAPI endpoint to `browser-service/main.py`.

## Conventions

- Python 3.12 with async/await patterns
- Pydantic models for request/response validation (define in `browser-service/models.py`)
- browser-use native imports: `from browser_use import Agent, Browser`
- LLM: `ChatOllama` native (NOT langchain) — `from browser_use import ChatOllama`
- ChatOllama: use `host` parameter (NOT `base_url`) — `host="http://ollama:11434"`
- Browser: `Browser(headless=True)` for Docker — uses system Chromium
- DO NOT import from langchain — browser-use has native LLM integrations
- Log with `logging` module, not print statements
- Return appropriate HTTP status codes with descriptive error messages

## REST Endpoint Template

```python
from fastapi import HTTPException
from models import MyRequest, MyResponse

@app.post("/my-endpoint", response_model=MyResponse)
async def my_endpoint(request: MyRequest):
    try:
        # Implementation
        return MyResponse(...)
    except Exception as e:
        logging.error(f"Error in /my-endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

## WebSocket Endpoint Template

```python
from fastapi import WebSocket, WebSocketDisconnect
import json

@app.websocket("/ws/my-endpoint/{id}")
async def ws_my_endpoint(websocket: WebSocket, id: str):
    await websocket.accept()
    try:
        # Send progress events
        await websocket.send_json({"type": "progress", "message": "Starting..."})
        # ... do work ...
        await websocket.send_json({"type": "done", "data": result})
    except WebSocketDisconnect:
        logging.info(f"WebSocket disconnected: {id}")
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
```

## After creating

1. Add any new Pydantic models to `browser-service/models.py`
2. Add any new dependencies to `browser-service/requirements.txt`
3. Verify the endpoint works by rebuilding: `docker compose up -d --build browser-use`
