"""Flight search routes — initiation and status polling."""

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.logger import get_logger
from app.models.domain import SearchStatus
from app.models.enums import SearchStatusValue
from app.models.requests import FlightSearchRequest
from app.models.responses import FlightSearchResponse
from app.services import search as search_service

logger = get_logger("routes.search")

router = APIRouter(tags=["search"])


@router.post("/search", response_model=FlightSearchResponse)
async def search_flights(request: FlightSearchRequest) -> FlightSearchResponse:
    """Initiate a flight search using the browser-use agent.

    Returns immediately with ``status="running"``.  Use
    ``GET /status/{search_id}`` or ``WS /ws/search/{search_id}``
    to track progress.
    """
    settings = get_settings()

    if search_service.is_at_capacity():
        raise HTTPException(
            status_code=429,
            detail=(
                f"Too many concurrent searches "
                f"(max {settings.max_concurrent_searches}). "
                f"Please try again shortly."
            ),
        )

    search_id = await search_service.start_search(request)
    logger.info(
        f"Started search {search_id}: {request.origin} → {request.destination}"
    )

    return FlightSearchResponse(
        search_id=search_id,
        status=SearchStatusValue.RUNNING,
        results=[],
    )


@router.get("/status/{search_id}", response_model=SearchStatus)
async def get_search_status(search_id: str) -> SearchStatus:
    """Get the current status of an ongoing or completed search."""
    status = search_service.get_search(search_id)
    if status is None:
        raise HTTPException(
            status_code=404,
            detail=f"Search {search_id} not found",
        )
    return status


@router.post("/search/{search_id}/cancel")
async def cancel_search(search_id: str) -> dict:
    """Cancel a running search.

    Returns ``{"cancelled": true}`` on success, or 404/409 on error.
    """
    status = search_service.get_search(search_id)
    if status is None:
        raise HTTPException(status_code=404, detail=f"Search {search_id} not found")

    cancelled = await search_service.cancel_search(search_id)
    if not cancelled:
        raise HTTPException(
            status_code=409,
            detail=f"Search {search_id} is not running (status: {status.status.value})",
        )

    logger.info(f"Cancelled search {search_id}")
    return {"cancelled": True, "search_id": search_id}
