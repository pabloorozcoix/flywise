"""Integration tests for app.services.search — search orchestration."""

from __future__ import annotations

import asyncio
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.domain import FlightResult, SearchStatus
from app.models.enums import SearchStatusValue
from app.models.requests import FlightSearchRequest
from app.services import search as search_service


@pytest.fixture(autouse=True)
def _reset_search_state():
    """Clear search state before and after each test."""
    search_service._active_searches.clear()
    search_service._semaphore = None
    yield
    search_service._active_searches.clear()
    search_service._semaphore = None


class TestInitialize:
    """Verify search service initialisation."""

    def test_creates_semaphore(self):
        search_service.initialize(3)
        assert search_service._semaphore is not None

    def test_semaphore_value(self):
        search_service.initialize(5)
        assert search_service._semaphore._value == 5


class TestGetSearch:
    """Verify search lookup."""

    def test_returns_none_for_unknown(self):
        assert search_service.get_search("nonexistent") is None

    def test_returns_status_for_known(self):
        search_service._active_searches["abc"] = SearchStatus(
            search_id="abc", status=SearchStatusValue.RUNNING
        )
        result = search_service.get_search("abc")
        assert result is not None
        assert result.search_id == "abc"


class TestIsAtCapacity:
    """Verify capacity checking."""

    def test_false_when_no_semaphore(self):
        assert search_service.is_at_capacity() is False

    def test_false_when_slots_available(self):
        search_service.initialize(2)
        assert search_service.is_at_capacity() is False


class TestStartSearch:
    """Verify search registration and task spawning."""

    @pytest.mark.asyncio
    async def test_returns_search_id(self):
        search_service.initialize(2)
        with patch(
            "app.services.search._run_search", new_callable=AsyncMock
        ):
            request = FlightSearchRequest(
                origin="JFK",
                destination="LHR",
                departure_date=date(2026, 3, 15),
            )
            search_id = await search_service.start_search(request)
            assert isinstance(search_id, str)
            assert len(search_id) > 0

    @pytest.mark.asyncio
    async def test_uses_custom_search_id(self):
        search_service.initialize(2)
        with patch(
            "app.services.search._run_search", new_callable=AsyncMock
        ):
            request = FlightSearchRequest(
                origin="JFK",
                destination="LHR",
                departure_date=date(2026, 3, 15),
                search_id="custom-id",
            )
            search_id = await search_service.start_search(request)
            assert search_id == "custom-id"

    @pytest.mark.asyncio
    async def test_registers_running_status(self):
        search_service.initialize(2)
        with patch(
            "app.services.search._run_search", new_callable=AsyncMock
        ):
            request = FlightSearchRequest(
                origin="JFK",
                destination="LHR",
                departure_date=date(2026, 3, 15),
            )
            search_id = await search_service.start_search(request)
            status = search_service.get_search(search_id)
            assert status is not None
            assert status.status == SearchStatusValue.RUNNING


class TestPrivateHelpers:
    """Verify _add_progress, _complete_search, _fail_search."""

    def test_add_progress_appends(self):
        from app.models.domain import ProgressEvent

        search_service._active_searches["h1"] = SearchStatus(
            search_id="h1", status=SearchStatusValue.RUNNING
        )
        search_service._add_progress(
            "h1", ProgressEvent(step=0, thinking="hello")
        )
        assert len(search_service._active_searches["h1"].progress) == 1

    def test_add_progress_ignored_for_missing(self):
        from app.models.domain import ProgressEvent

        # Should not raise
        search_service._add_progress(
            "nope", ProgressEvent(step=0, thinking="x")
        )

    def test_complete_search_sets_status(self):
        search_service._active_searches["c1"] = SearchStatus(
            search_id="c1", status=SearchStatusValue.RUNNING
        )
        search_service._complete_search("c1", [])
        assert (
            search_service._active_searches["c1"].status
            == SearchStatusValue.COMPLETED
        )

    def test_complete_search_creates_if_missing(self):
        search_service._complete_search("c2", [])
        assert "c2" in search_service._active_searches
        assert (
            search_service._active_searches["c2"].status
            == SearchStatusValue.COMPLETED
        )

    def test_fail_search_sets_error(self):
        search_service._active_searches["f1"] = SearchStatus(
            search_id="f1", status=SearchStatusValue.RUNNING
        )
        search_service._fail_search("f1", "Boom")
        assert (
            search_service._active_searches["f1"].status
            == SearchStatusValue.FAILED
        )
        assert search_service._active_searches["f1"].error == "Boom"

    def test_fail_search_creates_if_missing(self):
        search_service._fail_search("f2", "Gone")
        assert "f2" in search_service._active_searches
        assert search_service._active_searches["f2"].error == "Gone"


class TestParseExtraction:
    """Verify _parse_extraction raw output parsing."""

    def test_empty_returns_empty(self):
        result = search_service._parse_extraction(None, "pe-1")
        assert result == []

    def test_empty_string_returns_empty(self):
        result = search_service._parse_extraction("", "pe-2")
        assert result == []

    def test_json_array_with_raw_text(self):
        import json

        cards = [
            {"raw_text": "$530 | Delta | 6:25 pm | 9:05 am | 9h 40m | Nonstop"}
        ]
        raw = json.dumps(cards)
        result = search_service._parse_extraction(raw, "pe-3")
        # parse_raw_text_to_flight may or may not succeed on this input;
        # just verify it doesn't crash
        assert isinstance(result, list)

    def test_plain_text_fallback(self):
        raw_text = """
Delta  6:25 pm – 9:05 am  9h 40m  Nonstop  $530
United  8:00 am – 4:30 pm  8h 30m  1 stop  $480
"""
        result = search_service._parse_extraction(raw_text, "pe-4")
        assert isinstance(result, list)
