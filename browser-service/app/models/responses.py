"""Response models for the browser-use API."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.domain import FlightResult
from app.models.enums import SearchStatusValue


class HealthResponse(BaseModel):
    """Health check response body."""

    status: str = "ok"


class FlightSearchResponse(BaseModel):
    """Response body returned immediately by ``POST /search``."""

    search_id: str = Field(..., description="Unique search identifier")
    status: SearchStatusValue = Field(
        ..., description="Search status: running, completed, failed"
    )
    results: list[FlightResult] = Field(default_factory=list)
    error: str | None = Field(None, description="Error message if failed")
