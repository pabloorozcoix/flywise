---
name: test-browser-service
description: Write and run pytest tests for the browser-service Python FastAPI codebase. Use when adding, modifying, or debugging tests for browser-service/ code, or when aiming for 100% test coverage.
argument-hint: "[module or function to test, e.g. parsers/json_fixer or routes/health]"
---

# Browser-Service Testing — Skill

## Overview

100% test coverage for `browser-service/app/` using **pytest + pytest-asyncio + pytest-cov + respx**. Tests live in `browser-service/tests/` with `unit/` and `integration/` subdirectories. No external services required — all I/O is mocked.

## Test Stack

| Tool | Version | Purpose |
|------|---------|---------|
| `pytest` | `>=8.0` | Test runner + fixtures |
| `pytest-asyncio` | `>=0.24` | Async test support (FastAPI, services) |
| `pytest-cov` | `>=6.0` | Coverage reporting + enforcement |
| `respx` | `>=0.22` | Mock outbound `httpx` calls |

Dependencies are in `browser-service/requirements-test.txt` (separate from production).

## Directory Structure

```
browser-service/
├── tests/
│   ├── conftest.py                  # Shared fixtures (app client, state reset, mock browser)
│   ├── unit/
│   │   ├── test_config.py           # Settings defaults + env overrides
│   │   ├── test_logger.py           # Logger namespace + format
│   │   ├── test_enums.py            # CabinClass + SearchStatusValue values
│   │   ├── test_models.py           # Pydantic validation, defaults, serialization
│   │   ├── test_json_fixer.py       # fix_malformed_json, extract_individual_objects
│   │   ├── test_text_parser.py      # parse_raw_text_to_flight, try_parse_plain_text_flights
│   │   ├── test_flight_parser.py    # 7 strategies, normalize_result_keys, try_parse_flight_json
│   │   ├── test_kayak_prompts.py    # build_kayak_url (all combos), build_flight_search_prompt
│   │   ├── test_extraction_prompt.py # build_extraction_prompt smoke test
│   │   ├── test_stealth.py          # USER_AGENTS, STEALTH_JS content checks
│   │   └── test_selectors.py        # EXTRACTION_JS content checks
│   └── integration/
│       ├── test_health_route.py     # GET /health via TestClient
│       ├── test_search_route.py     # POST /search + GET /status/{id}
│       ├── test_websocket_route.py  # WS /ws/search/{id}
│       ├── test_callback_service.py # notify_callback with respx
│       ├── test_browser_service.py  # get_stealth_browser_config + mocked browser
│       └── test_search_service.py   # initialize, get_search, start_search, _run_search
├── pytest.ini                       # (or config in pyproject.toml)
└── requirements-test.txt            # Test-only dependencies
```

## Running Tests

```bash
# ─── Inside Docker (recommended) ───
make test-browser-use                 # Run all tests
make test-browser-use-cov             # Run with coverage report + 100% enforcement
make test-browser-use-unit            # Run unit tests only
make test-browser-use-integration     # Run integration tests only

# ─── Locally (if Python 3.12 + deps installed) ───
cd browser-service
pip install -r requirements.txt -r requirements-test.txt
pytest                                # All tests
pytest --cov=app --cov-report=term-missing --cov-fail-under=100
pytest tests/unit/                    # Unit only
pytest tests/integration/             # Integration only
pytest -k "test_fix_malformed_json"   # Single test
```

## Conventions

### General

- All test files: `from __future__ import annotations`
- Test functions: `async def test_*` for async, `def test_*` for sync
- Use `@pytest.mark.asyncio` for async tests (or `asyncio_mode = "auto"` in config)
- Use `@pytest.mark.parametrize` for edge-case variations
- Descriptive test names: `test_fix_malformed_json_smart_quotes`, not `test_1`
- One assertion per logical concern (multiple asserts OK for verifying a single object)

### Fixtures (conftest.py)

```python
"""Shared test fixtures for browser-service tests."""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    """Async HTTP client for testing FastAPI routes."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(autouse=True)
def reset_search_state():
    """Reset module-level search state between tests."""
    from app.services import search as search_service
    search_service._active_searches.clear()
    search_service._semaphore = None
    yield
    search_service._active_searches.clear()
    search_service._semaphore = None


@pytest.fixture
def mock_browser(monkeypatch):
    """Mock browser_use.Browser for service tests."""
    from unittest.mock import AsyncMock, MagicMock
    mock_page = AsyncMock()
    mock_page.evaluate = AsyncMock(return_value="[]")
    mock_page.goto = AsyncMock()
    mock_page.screenshot = AsyncMock(return_value=b"PNG")

    mock_context = AsyncMock()
    mock_context.pages = [mock_page]

    mock_browser = AsyncMock()
    mock_browser.start = AsyncMock(return_value=mock_context)
    mock_browser.stop = AsyncMock()

    return mock_browser, mock_context, mock_page
```

### Unit Tests

Unit tests cover **pure functions** with no I/O — no mocking required.

```python
# Example: test_json_fixer.py
from app.parsers.json_fixer import fix_malformed_json

@pytest.mark.parametrize("input_text,expected", [
    ('{"key": \u201cvalue\u201d}', '{"key": "value"}'),   # smart quotes
    ('{"a": 1,}', '{"a": 1}'),                            # trailing comma
    ('{key: "value"}', '{"key": "value"}'),                # unquoted keys
])
def test_fix_malformed_json(input_text, expected):
    assert fix_malformed_json(input_text) == expected
```

### Integration Tests

Integration tests use `httpx.AsyncClient` for HTTP, `respx` for outbound mocks.

```python
# Example: test_health_route.py
import pytest

@pytest.mark.asyncio
async def test_health_returns_ok(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

```python
# Example: test_callback_service.py — mock outbound HTTP
import pytest
import respx
from httpx import Response

from app.services.callback import notify_callback

@pytest.mark.asyncio
@respx.mock
async def test_notify_callback_posts_results():
    route = respx.post("http://nextjs:3000/api/callback/search-complete").mock(
        return_value=Response(200)
    )
    await notify_callback("search-123", "completed", results=[], error=None)
    assert route.called
```

### WebSocket Tests

```python
# Example: test_websocket_route.py
import pytest
from starlette.testclient import TestClient
from app.main import app

def test_websocket_sends_waiting_when_search_not_found():
    client = TestClient(app)
    with client.websocket_connect("/ws/search/nonexistent") as ws:
        data = ws.receive_json()
        assert data["type"] == "waiting"
```

### Config Tests (env overrides)

```python
# Example: test_config.py
def test_settings_defaults():
    from app.config import Settings
    s = Settings()
    assert s.ollama_host == "http://ollama:11434"
    assert s.max_concurrent_searches == 3

def test_settings_env_override(monkeypatch):
    monkeypatch.setenv("OLLAMA_HOST", "http://custom:1234")
    from app.config import Settings
    s = Settings()
    assert s.ollama_host == "http://custom:1234"
```

**Important**: Clear `@lru_cache` on `get_settings()` between tests:

```python
@pytest.fixture(autouse=True)
def clear_settings_cache():
    from app.config import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
```

## Coverage by Module

| Module | Key Functions to Test | Strategy |
|--------|----------------------|----------|
| `config.py` | `Settings()`, `get_settings()` | Defaults + `monkeypatch.setenv` |
| `logger.py` | `configure_logging()`, `get_logger()` | Assert logger name + level |
| `models/enums.py` | `CabinClass`, `SearchStatusValue` | Value + string serialization |
| `models/domain.py` | All 4 models | Validation, defaults, `.model_dump()` |
| `models/requests.py` | `FlightSearchRequest` | Required fields, optional defaults |
| `models/responses.py` | `HealthResponse`, `FlightSearchResponse` | Defaults, serialization |
| `parsers/json_fixer.py` | `fix_malformed_json`, `extract_individual_objects` | 20+ parametrize cases |
| `parsers/text_parser.py` | `parse_raw_text_to_flight`, `try_parse_plain_text_flights` | Real Kayak text fixtures |
| `parsers/flight_parser.py` | `normalize_result_keys`, `try_parse_flight_json`, 7 strategies | Mock history objects |
| `prompts/kayak.py` | `build_kayak_url`, `build_flight_search_prompt` | All cabin/direct combos |
| `prompts/extraction.py` | `build_extraction_prompt` | Non-empty string check |
| `constants/stealth.py` | `USER_AGENTS`, `STEALTH_JS` | Length, content assertions |
| `constants/selectors.py` | `EXTRACTION_JS` | Non-empty, contains selectors |
| `routes/health.py` | `GET /health` | `AsyncClient` |
| `routes/search.py` | `POST /search`, `GET /status/{id}` | Mock `search_service` |
| `routes/websocket.py` | `WS /ws/search/{id}` | `TestClient.websocket_connect` |
| `services/browser.py` | `get_stealth_browser_config`, `create_stealth_browser` | Pure + mocked |
| `services/callback.py` | `notify_callback` | `respx` mock |
| `services/search.py` | `initialize`, `get_search`, `start_search`, `_run_search` | State reset + browser mock |

## Gotchas

- **Module-level state**: `_active_searches` and `_semaphore` in `search.py` must be reset between tests via the `reset_search_state` fixture
- **`@lru_cache`**: `get_settings()` caches settings — clear with `get_settings.cache_clear()` in autouse fixture
- **Lazy imports**: `browser_use.Browser` is imported inside `create_stealth_browser()` — mock at the import site
- **`asyncio_mode`**: Set to `"auto"` in `pyproject.toml` to avoid per-test `@pytest.mark.asyncio` decoration
- **No external services**: All tests must pass without Docker, Ollama, PostgreSQL, or Chromium running
- **WebSocket tests**: Use Starlette's sync `TestClient` for WebSocket, not `httpx.AsyncClient`
