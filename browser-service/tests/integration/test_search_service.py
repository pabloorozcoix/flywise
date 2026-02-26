"""Integration tests for app.services.search — search orchestration."""

from __future__ import annotations

import asyncio
import sys
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


class TestRunSearchDispatch:
    """Verify _run_search dispatches to the correct strategy."""

    @pytest.mark.asyncio
    async def test_dispatches_to_direct_by_default(self):
        """Default extraction_mode='direct' calls _run_search_direct."""
        search_service.initialize(2)
        request = FlightSearchRequest(
            origin="JFK", destination="LHR", departure_date=date(2026, 3, 15),
        )
        with patch.object(
            search_service, "_run_search_direct", new_callable=AsyncMock
        ) as mock_direct, patch.object(
            search_service, "_run_search_agent", new_callable=AsyncMock
        ) as mock_agent:
            await search_service._run_search("sid-1", request)
            mock_direct.assert_awaited_once_with("sid-1", request)
            mock_agent.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_dispatches_to_agent_when_configured(self, monkeypatch):
        """extraction_mode='agent' calls _run_search_agent."""
        monkeypatch.setenv("EXTRACTION_MODE", "agent")
        search_service.initialize(2)
        request = FlightSearchRequest(
            origin="JFK", destination="LHR", departure_date=date(2026, 3, 15),
        )
        with patch.object(
            search_service, "_run_search_direct", new_callable=AsyncMock
        ) as mock_direct, patch.object(
            search_service, "_run_search_agent", new_callable=AsyncMock
        ) as mock_agent:
            await search_service._run_search("sid-2", request)
            mock_agent.assert_awaited_once_with("sid-2", request)
            mock_direct.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_dispatches_to_direct_for_unknown_mode(self, monkeypatch):
        """Unknown extraction_mode falls back to direct."""
        monkeypatch.setenv("EXTRACTION_MODE", "unknown")
        search_service.initialize(2)
        request = FlightSearchRequest(
            origin="JFK", destination="LHR", departure_date=date(2026, 3, 15),
        )
        with patch.object(
            search_service, "_run_search_direct", new_callable=AsyncMock
        ) as mock_direct:
            await search_service._run_search("sid-3", request)
            mock_direct.assert_awaited_once()


class TestCreateLlm:
    """Verify LLM factory for agent mode."""

    def test_falls_back_to_ollama_when_no_openai_key(self):
        """With empty OPENAI_API_KEY, returns ChatOllama."""
        from app.config import Settings

        settings = Settings()
        mock_ollama = MagicMock()
        with patch("browser_use.ChatOllama", mock_ollama):
            result = search_service._create_llm(settings)
            mock_ollama.assert_called_once_with(
                model=settings.ollama_model,
                host=settings.ollama_host,
            )

    def test_uses_openai_when_key_provided(self, monkeypatch):
        """With OPENAI_API_KEY set, returns browser-use ChatOpenAI."""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        from app.config import Settings

        settings = Settings()
        mock_chat_openai = MagicMock()

        with patch("browser_use.ChatOpenAI", mock_chat_openai):
            result = search_service._create_llm(settings)
            mock_chat_openai.assert_called_once_with(
                model=settings.openai_model,
                api_key="sk-test",
            )

    def test_openai_has_provider_property(self, monkeypatch):
        """browser-use ChatOpenAI exposes .provider as a property (Protocol compat)."""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        from app.config import Settings

        settings = Settings()

        # Use a fake that mimics browser-use's @dataclass ChatOpenAI
        class FakeChatOpenAI:
            def __init__(self, **kwargs):
                self.model = kwargs.get("model")

            @property
            def provider(self) -> str:
                return "openai"

        with patch("browser_use.ChatOpenAI", FakeChatOpenAI):
            result = search_service._create_llm(settings)
            assert result.provider == "openai"


class TestRunSearchAgent:
    """Verify the agent-driven search pipeline."""

    @pytest.mark.asyncio
    async def test_agent_completes_with_results(self, mock_browser):
        """Agent search completes and returns results from parser."""
        search_service.initialize(2)
        search_service._active_searches["agent-1"] = SearchStatus(
            search_id="agent-1", status=SearchStatusValue.RUNNING,
        )

        mock_browser_obj, mock_page = mock_browser
        request = FlightSearchRequest(
            origin="JFK", destination="LHR", departure_date=date(2026, 3, 15),
        )

        mock_agent_instance = AsyncMock()
        mock_history = MagicMock()
        mock_agent_instance.run.return_value = mock_history

        flight = FlightResult(
            airline="Delta", departure_time="6:00 pm",
            arrival_time="9:00 am", duration="9h", price=530.0,
        )

        with patch(
            "app.services.search.create_agent_browser",
            new_callable=AsyncMock, return_value=mock_browser_obj,
        ), patch(
            "app.services.search.close_browser", new_callable=AsyncMock,
        ), patch(
            "app.services.search.notify_callback", new_callable=AsyncMock,
        ), patch(
            "app.services.search.take_screenshot",
            new_callable=AsyncMock, return_value="base64img",
        ), patch(
            "browser_use.Agent", return_value=mock_agent_instance,
        ), patch(
            "app.parsers.flight_parser.parse_flight_results", return_value=[flight],
        ), patch(
            "browser_use.ChatOllama", return_value=MagicMock(),
        ):
            await search_service._run_search_agent("agent-1", request)
            status = search_service.get_search("agent-1")
            assert status is not None
            assert status.status == SearchStatusValue.COMPLETED
            assert len(status.results) == 1
            assert status.results[0].airline == "Delta"

    @pytest.mark.asyncio
    async def test_agent_handles_failure(self, mock_browser):
        """Agent search marks as failed on exception."""
        search_service.initialize(2)
        search_service._active_searches["agent-2"] = SearchStatus(
            search_id="agent-2", status=SearchStatusValue.RUNNING,
        )

        mock_browser_obj, mock_page = mock_browser
        request = FlightSearchRequest(
            origin="JFK", destination="LHR", departure_date=date(2026, 3, 15),
        )

        with patch(
            "app.services.search.create_agent_browser",
            new_callable=AsyncMock, side_effect=RuntimeError("Agent crash"),
        ), patch(
            "app.services.search.close_browser", new_callable=AsyncMock,
        ), patch(
            "app.services.search.notify_callback", new_callable=AsyncMock,
        ):
            await search_service._run_search_agent("agent-2", request)
            status = search_service.get_search("agent-2")
            assert status is not None
            assert status.status == SearchStatusValue.FAILED
            assert "Agent crash" in (status.error or "")

    @pytest.mark.asyncio
    async def test_agent_handles_cancellation(self, mock_browser):
        """Agent search handles CancelledError gracefully."""
        search_service.initialize(2)
        search_service._active_searches["agent-3"] = SearchStatus(
            search_id="agent-3", status=SearchStatusValue.RUNNING,
        )

        mock_browser_obj, mock_page = mock_browser
        request = FlightSearchRequest(
            origin="JFK", destination="LHR", departure_date=date(2026, 3, 15),
        )

        async def raise_cancelled(*args, **kwargs):
            raise asyncio.CancelledError()

        with patch(
            "app.services.search.create_agent_browser",
            new_callable=AsyncMock, side_effect=raise_cancelled,
        ), patch(
            "app.services.search.close_browser", new_callable=AsyncMock,
        ), patch(
            "app.services.search.notify_callback", new_callable=AsyncMock,
        ):
            await search_service._run_search_agent("agent-3", request)
            status = search_service.get_search("agent-3")
            assert status is not None
            assert status.status == SearchStatusValue.CANCELLED
