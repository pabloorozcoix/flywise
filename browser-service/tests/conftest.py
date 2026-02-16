"""Shared test fixtures for browser-service tests.

Provides async HTTP client, search state reset, settings cache clear,
and mock browser objects used across unit and integration tests.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


# ── Async HTTP Client ───────────────────────────────────────────


@pytest.fixture
async def client():
    """Async HTTP client for testing FastAPI routes."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ── Settings Cache Reset ───────────────────────────────────────


@pytest.fixture(autouse=True)
def clear_settings_cache():
    """Clear the @lru_cache on get_settings() between every test."""
    from app.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


# ── Search State Reset ─────────────────────────────────────────


@pytest.fixture(autouse=True)
def reset_search_state():
    """Reset module-level search state between tests."""
    from app.services import search as search_service

    search_service._active_searches.clear()
    search_service._semaphore = None
    yield
    search_service._active_searches.clear()
    search_service._semaphore = None


# ── Mock Browser ───────────────────────────────────────────────


@pytest.fixture
def mock_browser():
    """Return (browser, page) async mocks for service tests."""
    from unittest.mock import AsyncMock

    mock_page = AsyncMock()
    mock_page.evaluate = AsyncMock(return_value="[]")
    mock_page.goto = AsyncMock()
    mock_page.screenshot = AsyncMock(return_value=b"PNG")
    mock_page.url = "https://www.kayak.com/flights/JFK-LHR/2026-03-15"

    mock_browser_obj = AsyncMock()
    mock_browser_obj.get_current_page = AsyncMock(return_value=mock_page)
    mock_browser_obj.stop = AsyncMock()

    # CDP session mock for stealth injection
    mock_cdp = AsyncMock()
    mock_cdp.cdp_client = AsyncMock()
    mock_browser_obj.get_or_create_cdp_session = AsyncMock(return_value=mock_cdp)

    return mock_browser_obj, mock_page
