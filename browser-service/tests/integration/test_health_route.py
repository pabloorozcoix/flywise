"""Integration tests for app.routes.health — GET /health endpoint."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    """Create an async HTTP test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestHealthRoute:
    """Verify GET /health returns correct response."""

    @pytest.mark.asyncio
    async def test_health_returns_200(self, client: AsyncClient):
        resp = await client.get("/health")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_health_returns_ok_status(self, client: AsyncClient):
        resp = await client.get("/health")
        data = resp.json()
        assert data["status"] == "ok"

    @pytest.mark.asyncio
    async def test_health_json_content_type(self, client: AsyncClient):
        resp = await client.get("/health")
        assert "application/json" in resp.headers["content-type"]
