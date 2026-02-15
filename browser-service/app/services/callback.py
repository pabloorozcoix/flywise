"""Callback notification to the Next.js backend.

After a search completes (success or failure), the results are POSTed
to a Next.js API route for persistence in the database.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import get_settings
from app.logger import get_logger
from app.models.domain import FlightResult

logger = get_logger("services.callback")


async def notify_callback(
    search_id: str,
    status: str,
    results: list[FlightResult] | None = None,
    error: str | None = None,
) -> None:
    """Send search results to the Next.js callback endpoint.

    Args:
        search_id: Unique search identifier.
        status: Final status string (``"completed"`` or ``"failed"``).
        results: List of flight results (on success).
        error: Error message (on failure).
    """
    settings = get_settings()
    payload: dict[str, Any] = {"search_id": search_id, "status": status}

    if results is not None:
        payload["results"] = [r.model_dump() for r in results]
    if error is not None:
        payload["error"] = error

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(settings.nextjs_callback_url, json=payload)
            if resp.status_code != 200:
                logger.warning(
                    f"Callback returned {resp.status_code}: {resp.text}"
                )
            else:
                logger.info(f"Callback succeeded for search {search_id}")
    except Exception as exc:
        logger.error(f"Failed to notify callback for search {search_id}: {exc}")
