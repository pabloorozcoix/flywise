"""Pydantic models for the browser-use FastAPI service."""

from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class FlightSearchRequest(BaseModel):
    """Request model for flight search."""

    search_id: Optional[str] = Field(None, description="Search ID from the caller (for DB persistence)")
    origin: str = Field(..., min_length=2, max_length=10, description="Origin airport code (e.g., JFK)")
    destination: str = Field(..., min_length=2, max_length=10, description="Destination airport code (e.g., LHR)")
    departure_date: date = Field(..., description="Departure date")
    return_date: Optional[date] = Field(None, description="Return date (optional for one-way)")
    cabin_class: str = Field("economy", description="Cabin class: economy, business, first")
    direct_only: bool = Field(False, description="Only show direct/non-stop flights")


class FlightResult(BaseModel):
    """A single flight result extracted by the agent."""

    airline: str = Field(..., description="Airline name")
    departure_time: str = Field(..., description="Departure time")
    arrival_time: str = Field(..., description="Arrival time")
    duration: str = Field(..., description="Flight duration (e.g., '7h 30m')")
    stops: int = Field(0, description="Number of stops (0 = non-stop)")
    price: float = Field(..., description="Price in the currency")
    currency: str = Field("USD", description="Currency code")
    flight_url: Optional[str] = Field(None, description="URL to book the flight")


class FlightSearchResponse(BaseModel):
    """Response model for flight search."""

    search_id: str = Field(..., description="Unique search identifier")
    status: str = Field(..., description="Search status: running, completed, failed")
    results: list[FlightResult] = Field(default_factory=list, description="List of flight results")
    error: Optional[str] = Field(None, description="Error message if failed")


class SearchStatus(BaseModel):
    """Status of an ongoing search."""

    search_id: str
    status: str
    progress: list[dict] = Field(default_factory=list)
    results: list[FlightResult] = Field(default_factory=list)
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "ok"


class FlightResultsOutput(BaseModel):
    """Structured output model for agent extraction.

    Used as `output_model_schema` so the agent returns data in a
    well-defined JSON structure that can be reliably parsed.
    """

    flights: list[FlightResult] = Field(
        default_factory=list,
        description="List of extracted flight results",
    )
    total_count: int = Field(0, description="Total number of flights found on the page")
    search_completed: bool = Field(True, description="Whether the search completed successfully")
    error_message: Optional[str] = Field(None, description="Error message if extraction failed")
