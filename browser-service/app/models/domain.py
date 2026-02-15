"""Domain models for flight results and search state."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.enums import SearchStatusValue


class FlightResult(BaseModel):
    """A single flight result extracted from a travel search page."""

    airline: str = Field(..., description="Airline name")
    departure_time: str = Field(..., description="Departure time")
    arrival_time: str = Field(..., description="Arrival time")
    duration: str = Field(..., description="Flight duration (e.g., '7h 30m')")
    stops: int = Field(0, description="Number of stops (0 = non-stop)")
    price: float = Field(..., description="Price in the currency")
    currency: str = Field("USD", description="Currency code")
    flight_url: str | None = Field(None, description="URL to book the flight")


class ProgressEvent(BaseModel):
    """A single step in the search execution timeline.

    Replaces untyped ``dict`` usage for progress tracking, providing
    strong typing and clear field documentation.
    """

    step: int = 0
    url: str | None = None
    title: str | None = None
    thinking: str = ""
    evaluation: str | None = None
    memory: str | None = None
    next_goal: str = ""
    actions: list[str] = Field(default_factory=list)
    screenshot: str | None = None


class SearchStatus(BaseModel):
    """Status of an ongoing or completed search."""

    search_id: str
    status: SearchStatusValue = SearchStatusValue.RUNNING
    progress: list[ProgressEvent] = Field(default_factory=list)
    results: list[FlightResult] = Field(default_factory=list)
    error: str | None = None


class FlightResultsOutput(BaseModel):
    """Structured output model for agent extraction.

    Used as ``output_model_schema`` so the agent returns data in a
    well-defined JSON structure that can be reliably parsed.
    """

    flights: list[FlightResult] = Field(
        default_factory=list,
        description="List of extracted flight results",
    )
    total_count: int = Field(
        0, description="Total number of flights found on the page"
    )
    search_completed: bool = Field(
        True, description="Whether the search completed successfully"
    )
    error_message: str | None = Field(
        None, description="Error message if extraction failed"
    )
