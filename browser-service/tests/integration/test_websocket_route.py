"""Integration tests for app.routes.websocket — WS /ws/search/{search_id}."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.models.domain import ProgressEvent, SearchStatus
from app.models.enums import SearchStatusValue
from app.services import search as search_service


@pytest.fixture(autouse=True)
def _init_search_service():
    """Ensure the search service is initialised before each test."""
    search_service.initialize(2)
    yield
    search_service._active_searches.clear()


class TestWebSocketSearch:
    """Verify WebSocket /ws/search/{search_id} behaviour."""

    def test_ws_connects_for_unknown_search(self):
        """WebSocket should accept even if search not found yet."""
        client = TestClient(app)
        with client.websocket_connect("/ws/search/unknown-id") as ws:
            data = ws.receive_json()
            assert data["type"] == "status"
            assert "Waiting" in data["message"]

    def test_ws_sends_status_for_running_search(self):
        """WebSocket should send current status on connect."""
        search_service._active_searches["run-1"] = SearchStatus(
            search_id="run-1", status=SearchStatusValue.RUNNING
        )
        client = TestClient(app)
        with client.websocket_connect("/ws/search/run-1") as ws:
            data = ws.receive_json()
            assert data["type"] == "status"
            assert "running" in data["message"]

    def test_ws_sends_done_for_completed_search(self):
        """WebSocket should send done event immediately for completed searches."""
        search_service._active_searches["done-1"] = SearchStatus(
            search_id="done-1",
            status=SearchStatusValue.COMPLETED,
            results=[],
        )
        client = TestClient(app)
        with client.websocket_connect("/ws/search/done-1") as ws:
            status_msg = ws.receive_json()
            assert status_msg["type"] == "status"
            done_msg = ws.receive_json()
            assert done_msg["type"] == "done"
            assert done_msg["results"] == []

    def test_ws_sends_error_for_failed_search(self):
        """WebSocket should send error event for failed searches."""
        search_service._active_searches["fail-1"] = SearchStatus(
            search_id="fail-1",
            status=SearchStatusValue.FAILED,
            error="Timeout exceeded",
        )
        client = TestClient(app)
        with client.websocket_connect("/ws/search/fail-1") as ws:
            status_msg = ws.receive_json()
            assert status_msg["type"] == "status"
            error_msg = ws.receive_json()
            assert error_msg["type"] == "error"
            assert "Timeout" in error_msg["message"]

    def test_ws_sends_progress_events(self):
        """WebSocket should send progress events that occurred before connect."""
        search_service._active_searches["prog-1"] = SearchStatus(
            search_id="prog-1",
            status=SearchStatusValue.COMPLETED,
            progress=[
                ProgressEvent(step=0, thinking="Init...", next_goal="Start"),
                ProgressEvent(step=1, thinking="Navigate...", next_goal="Load"),
            ],
            results=[],
        )
        client = TestClient(app)
        with client.websocket_connect("/ws/search/prog-1") as ws:
            status_msg = ws.receive_json()
            assert status_msg["type"] == "status"

            p1 = ws.receive_json()
            assert p1["type"] == "progress"
            assert p1["step"] == 0

            p2 = ws.receive_json()
            assert p2["type"] == "progress"
            assert p2["step"] == 1

            done_msg = ws.receive_json()
            assert done_msg["type"] == "done"
