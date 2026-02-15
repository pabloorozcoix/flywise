"""Pydantic models for the browser-use service.

Re-exports all model classes for convenient top-level access::

    from app.models import FlightResult, FlightSearchRequest
"""

from app.models.domain import (
    FlightResult,
    FlightResultsOutput,
    ProgressEvent,
    SearchStatus,
)
from app.models.enums import CabinClass, SearchStatusValue
from app.models.requests import FlightSearchRequest
from app.models.responses import FlightSearchResponse, HealthResponse

__all__ = [
    "CabinClass",
    "FlightResult",
    "FlightResultsOutput",
    "FlightSearchRequest",
    "FlightSearchResponse",
    "HealthResponse",
    "ProgressEvent",
    "SearchStatus",
    "SearchStatusValue",
]
