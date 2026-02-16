"""Tests for Pydantic domain models — validation, defaults, serialization."""

from __future__ import annotations

import pytest

from app.models.domain import (
    FlightResult,
    FlightResultsOutput,
    ProgressEvent,
    SearchStatus,
)
from app.models.enums import SearchStatusValue
from app.models.requests import FlightSearchRequest
from app.models.responses import FlightSearchResponse, HealthResponse


# ── FlightResult ────────────────────────────────────────────────


class TestFlightResult:
    def test_required_fields(self):
        fr = FlightResult(
            airline="Delta",
            departure_time="8:00 AM",
            arrival_time="4:30 PM",
            duration="8h 30m",
            price=450.0,
        )
        assert fr.airline == "Delta"
        assert fr.price == 450.0

    def test_defaults(self):
        fr = FlightResult(
            airline="United",
            departure_time="10:00 AM",
            arrival_time="6:00 PM",
            duration="8h",
            price=300.0,
        )
        assert fr.stops == 0
        assert fr.currency == "USD"
        assert fr.flight_url is None

    def test_optional_flight_url(self):
        fr = FlightResult(
            airline="AA",
            departure_time="9:00 AM",
            arrival_time="5:00 PM",
            duration="8h",
            price=500.0,
            flight_url="https://kayak.com/book",
        )
        assert fr.flight_url == "https://kayak.com/book"

    def test_model_dump(self):
        fr = FlightResult(
            airline="BA",
            departure_time="7:00 AM",
            arrival_time="3:00 PM",
            duration="8h",
            price=600.0,
            stops=1,
            currency="GBP",
        )
        d = fr.model_dump()
        assert d["airline"] == "BA"
        assert d["stops"] == 1
        assert d["currency"] == "GBP"

    def test_missing_required_field_raises(self):
        with pytest.raises(Exception):
            FlightResult(departure_time="8:00 AM", arrival_time="4:30 PM", duration="8h", price=100)


# ── ProgressEvent ───────────────────────────────────────────────


class TestProgressEvent:
    def test_defaults(self):
        pe = ProgressEvent()
        assert pe.step == 0
        assert pe.url is None
        assert pe.title is None
        assert pe.thinking == ""
        assert pe.evaluation is None
        assert pe.memory is None
        assert pe.next_goal == ""
        assert pe.actions == []
        assert pe.screenshot is None

    def test_custom_values(self):
        pe = ProgressEvent(step=3, thinking="Loading...", next_goal="Extract")
        assert pe.step == 3
        assert pe.thinking == "Loading..."

    def test_actions_is_list(self):
        pe = ProgressEvent(actions=["click", "scroll"])
        assert len(pe.actions) == 2


# ── SearchStatus ────────────────────────────────────────────────


class TestSearchStatus:
    def test_required_search_id(self):
        ss = SearchStatus(search_id="abc-123")
        assert ss.search_id == "abc-123"

    def test_defaults(self):
        ss = SearchStatus(search_id="test")
        assert ss.status == SearchStatusValue.RUNNING
        assert ss.progress == []
        assert ss.results == []
        assert ss.error is None

    def test_model_dump_serializes_status(self):
        ss = SearchStatus(
            search_id="x",
            status=SearchStatusValue.COMPLETED,
        )
        d = ss.model_dump()
        assert d["status"] == "completed"


# ── FlightResultsOutput ────────────────────────────────────────


class TestFlightResultsOutput:
    def test_defaults(self):
        fro = FlightResultsOutput()
        assert fro.flights == []
        assert fro.total_count == 0
        assert fro.search_completed is True
        assert fro.error_message is None

    def test_with_flights(self):
        flight = FlightResult(
            airline="Delta",
            departure_time="8:00 AM",
            arrival_time="4:00 PM",
            duration="8h",
            price=400.0,
        )
        fro = FlightResultsOutput(flights=[flight], total_count=1)
        assert len(fro.flights) == 1
        assert fro.total_count == 1


# ── FlightSearchRequest ────────────────────────────────────────


class TestFlightSearchRequest:
    def test_required_fields(self):
        from datetime import date

        req = FlightSearchRequest(
            origin="JFK",
            destination="LHR",
            departure_date=date(2026, 3, 15),
        )
        assert req.origin == "JFK"
        assert req.destination == "LHR"

    def test_defaults(self):
        from datetime import date

        req = FlightSearchRequest(
            origin="LAX",
            destination="CDG",
            departure_date=date(2026, 6, 1),
        )
        assert req.search_id is None
        assert req.return_date is None
        assert req.cabin_class.value == "economy"
        assert req.direct_only is False
        assert req.openai_api_key is None

    def test_all_fields(self):
        from datetime import date

        req = FlightSearchRequest(
            search_id="custom-id",
            origin="SFO",
            destination="NRT",
            departure_date=date(2026, 4, 1),
            return_date=date(2026, 4, 15),
            cabin_class="business",
            direct_only=True,
            openai_api_key="sk-xyz",
        )
        assert req.search_id == "custom-id"
        assert req.direct_only is True

    def test_origin_min_length(self):
        from datetime import date

        with pytest.raises(Exception):
            FlightSearchRequest(
                origin="J",
                destination="LHR",
                departure_date=date(2026, 3, 15),
            )


# ── HealthResponse ──────────────────────────────────────────────


class TestHealthResponse:
    def test_default_status(self):
        hr = HealthResponse()
        assert hr.status == "ok"

    def test_custom_status(self):
        hr = HealthResponse(status="degraded")
        assert hr.status == "degraded"


# ── FlightSearchResponse ───────────────────────────────────────


class TestFlightSearchResponse:
    def test_required_fields(self):
        resp = FlightSearchResponse(
            search_id="abc",
            status=SearchStatusValue.RUNNING,
        )
        assert resp.search_id == "abc"
        assert resp.status == SearchStatusValue.RUNNING

    def test_defaults(self):
        resp = FlightSearchResponse(
            search_id="abc",
            status=SearchStatusValue.RUNNING,
        )
        assert resp.results == []
        assert resp.error is None

    def test_model_dump(self):
        resp = FlightSearchResponse(
            search_id="xyz",
            status=SearchStatusValue.COMPLETED,
            error="timeout",
        )
        d = resp.model_dump()
        assert d["error"] == "timeout"
        assert d["status"] == "completed"
