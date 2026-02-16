"""Integration tests for app.routes.search — POST /search and GET /status."""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.enums import SearchStatusValue
from app.services import search as search_service


@pytest.fixture
async def client():
    """Create an async HTTP test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture(autouse=True)
def _init_search_service():
    """Ensure the search service is initialised before each test."""
    search_service.initialize(2)
    yield
    search_service._active_searches.clear()


class TestPostSearch:
    """Verify POST /search route behaviour."""

    @pytest.mark.asyncio
    async def test_returns_202_or_200(self, client: AsyncClient):
        with patch(
            "app.services.search._run_search", new_callable=AsyncMock
        ):
            resp = await client.post(
                "/search",
                json={
                    "origin": "JFK",
                    "destination": "LHR",
                    "departure_date": "2026-03-15",
                },
            )
            assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_returns_search_id(self, client: AsyncClient):
        with patch(
            "app.services.search._run_search", new_callable=AsyncMock
        ):
            resp = await client.post(
                "/search",
                json={
                    "origin": "JFK",
                    "destination": "LHR",
                    "departure_date": "2026-03-15",
                },
            )
            data = resp.json()
            assert "search_id" in data
            assert len(data["search_id"]) > 0

    @pytest.mark.asyncio
    async def test_returns_running_status(self, client: AsyncClient):
        with patch(
            "app.services.search._run_search", new_callable=AsyncMock
        ):
            resp = await client.post(
                "/search",
                json={
                    "origin": "JFK",
                    "destination": "LHR",
                    "departure_date": "2026-03-15",
                },
            )
            data = resp.json()
            assert data["status"] == "running"

    @pytest.mark.asyncio
    async def test_at_capacity_returns_429(self, client: AsyncClient):
        with patch(
            "app.services.search.is_at_capacity", return_value=True
        ):
            resp = await client.post(
                "/search",
                json={
                    "origin": "JFK",
                    "destination": "LHR",
                    "departure_date": "2026-03-15",
                },
            )
            assert resp.status_code == 429

    @pytest.mark.asyncio
    async def test_invalid_body_returns_422(self, client: AsyncClient):
        resp = await client.post("/search", json={})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_custom_search_id(self, client: AsyncClient):
        with patch(
            "app.services.search._run_search", new_callable=AsyncMock
        ):
            resp = await client.post(
                "/search",
                json={
                    "origin": "JFK",
                    "destination": "LHR",
                    "departure_date": "2026-03-15",
                    "search_id": "my-custom-id",
                },
            )
            data = resp.json()
            assert data["search_id"] == "my-custom-id"


class TestGetStatus:
    """Verify GET /status/{search_id} route behaviour."""

    @pytest.mark.asyncio
    async def test_existing_search_returns_200(self, client: AsyncClient):
        from app.models.domain import SearchStatus

        search_service._active_searches["abc"] = SearchStatus(
            search_id="abc", status=SearchStatusValue.RUNNING
        )
        resp = await client.get("/status/abc")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_existing_search_returns_data(self, client: AsyncClient):
        from app.models.domain import SearchStatus

        search_service._active_searches["xyz"] = SearchStatus(
            search_id="xyz", status=SearchStatusValue.COMPLETED
        )
        resp = await client.get("/status/xyz")
        data = resp.json()
        assert data["search_id"] == "xyz"
        assert data["status"] == "completed"

    @pytest.mark.asyncio
    async def test_unknown_search_returns_404(self, client: AsyncClient):
        resp = await client.get("/status/nonexistent")
        assert resp.status_code == 404
