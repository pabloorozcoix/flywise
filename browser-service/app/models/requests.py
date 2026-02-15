"""Request models for the browser-use API."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field

from app.models.enums import CabinClass


class FlightSearchRequest(BaseModel):
    """Request body for ``POST /search``."""

    search_id: str | None = Field(
        None, description="Caller-provided search ID for DB persistence"
    )
    origin: str = Field(
        ..., min_length=2, max_length=10, description="Origin airport code (e.g., JFK)"
    )
    destination: str = Field(
        ..., min_length=2, max_length=10, description="Destination airport code (e.g., LHR)"
    )
    departure_date: date = Field(..., description="Departure date")
    return_date: date | None = Field(
        None, description="Return date (optional for one-way)"
    )
    cabin_class: CabinClass = Field(
        CabinClass.ECONOMY, description="Cabin class"
    )
    direct_only: bool = Field(
        False, description="Only show direct/non-stop flights"
    )
    openai_api_key: str | None = Field(
        None,
        description="Optional OpenAI API key; uses OpenAI instead of Ollama when provided",
    )
