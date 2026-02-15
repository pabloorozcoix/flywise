"""WebSocket route for streaming search progress events."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.logger import get_logger
from app.models.domain import ProgressEvent
from app.models.enums import SearchStatusValue
from app.services import search as search_service

logger = get_logger("routes.websocket")

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/search/{search_id}")
async def ws_search(websocket: WebSocket, search_id: str) -> None:
    """Stream real-time progress for an already-running search.

    Clients connect here after calling ``POST /search``.  The endpoint
    pushes ``progress``, ``done``, or ``error`` events as the search
    proceeds.
    """
    await websocket.accept()
    logger.info(f"WebSocket connected for search {search_id}")

    sent_progress_count = 0

    try:
        # Send current status immediately
        status = search_service.get_search(search_id)

        if status is not None:
            await websocket.send_json({
                "type": "status",
                "message": f"Search is {status.status.value}",
                "search_id": search_id,
            })

            # Catch up: send progress events that occurred before WS connected
            for evt in status.progress:
                await _send_step_event(websocket, evt)
                sent_progress_count += 1

            # If already terminal, send final state and close
            if status.status == SearchStatusValue.COMPLETED:
                await _send_done(websocket, status)
                return
            if status.status == SearchStatusValue.FAILED:
                await _send_error(websocket, status.error)
                return
        else:
            await websocket.send_json({
                "type": "status",
                "message": "Waiting for search to start...",
                "search_id": search_id,
            })

        # Stream events until search terminates or client disconnects
        while True:
            await asyncio.sleep(10)

            status = search_service.get_search(search_id)
            if status is None:
                await websocket.send_json({
                    "type": "status",
                    "message": "Waiting for search to start...",
                })
                continue

            # Push new progress events
            while sent_progress_count < len(status.progress):
                await _send_step_event(
                    websocket, status.progress[sent_progress_count]
                )
                sent_progress_count += 1

            if status.status == SearchStatusValue.COMPLETED:
                await _send_done(websocket, status)
                break
            if status.status == SearchStatusValue.FAILED:
                await _send_error(websocket, status.error)
                break

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {search_id}")
    except Exception as exc:
        logger.error(f"WebSocket error for {search_id}: {exc}")


# ── Private helpers ─────────────────────────────────────────────


async def _send_step_event(websocket: WebSocket, evt: ProgressEvent) -> None:
    """Send a single progress step event over the WebSocket."""
    message = f"Step {evt.step}: {evt.next_goal or 'Thinking...'}"
    if evt.url:
        message += f" — {evt.url}"

    await websocket.send_json({
        "type": "progress",
        "message": message,
        "step": evt.step,
        "url": evt.url,
        "title": evt.title,
        "thinking": evt.thinking,
        "evaluation": evt.evaluation,
        "memory": evt.memory,
        "next_goal": evt.next_goal or "Thinking...",
        "actions": evt.actions,
        "screenshot_url": (
            f"data:image/png;base64,{evt.screenshot}"
            if evt.screenshot
            else None
        ),
    })


async def _send_done(websocket: WebSocket, status) -> None:
    """Send the terminal 'done' event with results."""
    results = status.results or []
    await websocket.send_json({
        "type": "done",
        "message": "Search complete",
        "results": [r.model_dump() for r in results],
    })


async def _send_error(websocket: WebSocket, error: str | None) -> None:
    """Send the terminal 'error' event."""
    await websocket.send_json({
        "type": "error",
        "message": error or "Search failed",
    })
