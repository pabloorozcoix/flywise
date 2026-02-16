"""Integration tests for app.services.callback — notify_callback."""

from __future__ import annotations

from unittest.mock import patch

import httpx
import pytest
import respx

from app.models.domain import FlightResult
from app.services.callback import notify_callback


class TestNotifyCallback:
    """Verify callback POST to Next.js endpoint."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_successful_callback(self):
        """Should POST to the configured callback URL."""
        route = respx.post("http://nextjs:3000/api/callback").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        with patch(
            "app.services.callback.get_settings"
        ) as mock_settings:
            mock_settings.return_value.nextjs_callback_url = (
                "http://nextjs:3000/api/callback"
            )
            await notify_callback("search-1", "completed")

        assert route.called

    @respx.mock
    @pytest.mark.asyncio
    async def test_callback_sends_search_id_and_status(self):
        """Payload should contain search_id and status."""
        route = respx.post("http://nextjs:3000/api/callback").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        with patch(
            "app.services.callback.get_settings"
        ) as mock_settings:
            mock_settings.return_value.nextjs_callback_url = (
                "http://nextjs:3000/api/callback"
            )
            await notify_callback("search-1", "completed")

        body = route.calls[0].request.content
        import json

        payload = json.loads(body)
        assert payload["search_id"] == "search-1"
        assert payload["status"] == "completed"

    @respx.mock
    @pytest.mark.asyncio
    async def test_callback_sends_results(self):
        """Should include serialised flight results when provided."""
        route = respx.post("http://nextjs:3000/api/callback").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        results = [
            FlightResult(
                airline="Delta",
                departure_time="08:00",
                arrival_time="16:00",
                duration="8h 0m",
                stops=0,
                price=450.0,
                currency="USD",
            )
        ]
        with patch(
            "app.services.callback.get_settings"
        ) as mock_settings:
            mock_settings.return_value.nextjs_callback_url = (
                "http://nextjs:3000/api/callback"
            )
            await notify_callback("search-2", "completed", results=results)

        import json

        payload = json.loads(route.calls[0].request.content)
        assert len(payload["results"]) == 1
        assert payload["results"][0]["airline"] == "Delta"

    @respx.mock
    @pytest.mark.asyncio
    async def test_callback_sends_error(self):
        """Should include error string when provided."""
        route = respx.post("http://nextjs:3000/api/callback").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        with patch(
            "app.services.callback.get_settings"
        ) as mock_settings:
            mock_settings.return_value.nextjs_callback_url = (
                "http://nextjs:3000/api/callback"
            )
            await notify_callback("search-3", "failed", error="Timeout")

        import json

        payload = json.loads(route.calls[0].request.content)
        assert payload["error"] == "Timeout"

    @respx.mock
    @pytest.mark.asyncio
    async def test_callback_handles_non_200(self):
        """Should not raise on non-200 response (just logs warning)."""
        respx.post("http://nextjs:3000/api/callback").mock(
            return_value=httpx.Response(500, text="Server Error")
        )
        with patch(
            "app.services.callback.get_settings"
        ) as mock_settings:
            mock_settings.return_value.nextjs_callback_url = (
                "http://nextjs:3000/api/callback"
            )
            # Should not raise
            await notify_callback("search-4", "completed")

    @respx.mock
    @pytest.mark.asyncio
    async def test_callback_handles_network_error(self):
        """Should handle connection errors gracefully (logs, no raise)."""
        respx.post("http://nextjs:3000/api/callback").mock(
            side_effect=httpx.ConnectError("Connection refused")
        )
        with patch(
            "app.services.callback.get_settings"
        ) as mock_settings:
            mock_settings.return_value.nextjs_callback_url = (
                "http://nextjs:3000/api/callback"
            )
            # Should not raise
            await notify_callback("search-5", "failed", error="oops")
