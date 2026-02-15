---
name: browser-use-patterns
description: Architecture, conventions, and code patterns for the browser-use Python FastAPI service. Use when working with browser-service/ code, understanding its layered architecture, or reviewing Python patterns.
user-invocable: false
---

# Browser-Use Service — Patterns & Conventions

## Architecture

Layered architecture under `browser-service/app/`:

```
app/
├── main.py                # FastAPI app factory (lifespan, CORS, router registration)
├── config.py              # pydantic-settings Settings class (env vars)
├── logger.py              # Structured logging factory
├── routes/                # API layer — thin controllers
│   ├── __init__.py        #   api_router aggregation (include_router)
│   ├── health.py          #   GET /health
│   ├── search.py          #   POST /search, GET /status/{id}
│   └── websocket.py       #   WS /ws/search/{id}
├── services/              # Business logic & orchestration
│   ├── browser.py         #   Stealth browser lifecycle (create, screenshot, close)
│   ├── callback.py        #   POST results to Next.js callback
│   └── search.py          #   Search orchestration (semaphore, background tasks)
├── models/                # Pydantic domain models
│   ├── enums.py           #   CabinClass, SearchStatusValue (str, Enum)
│   ├── domain.py          #   FlightResult, ProgressEvent, SearchStatus, FlightResultsOutput
│   ├── requests.py        #   FlightSearchRequest
│   └── responses.py       #   HealthResponse, FlightSearchResponse
├── constants/             # Static configuration values
│   ├── stealth.py         #   USER_AGENTS list, STEALTH_JS CDP injection script
│   └── selectors.py       #   EXTRACTION_JS DOM scraper script
├── prompts/               # Agent prompt engineering
│   ├── kayak.py           #   URL builder + search prompt templates
│   └── extraction.py      #   Structured extraction prompt
└── parsers/               # Multi-strategy result extraction
    ├── json_fixer.py      #   LLM JSON repair (smart quotes, trailing commas)
    ├── text_parser.py     #   Heuristic text → FlightResult parser
    └── flight_parser.py   #   7-strategy parser orchestrator
```

## Code Conventions

### Python Version & Typing
- Python 3.12+
- Modern union syntax: `str | None` (not `Optional[str]`)
- Generic types: `list[...]`, `dict[...]` (not `List`, `Dict`)
- `from __future__ import annotations` in all non-trivial modules

### Imports
- Absolute app imports: `from app.models.domain import FlightResult`
- Module-level namespace imports for services: `from app.services import search as search_service`
- Lazy imports for heavy dependencies (browser_use) inside factory functions

### Pydantic
- All I/O through Pydantic `BaseModel` with `Field()` descriptors
- Enums: `(str, Enum)` dual inheritance for JSON serialization
- Settings via `pydantic-settings` `BaseSettings` with `@lru_cache` singleton

### Async
- All routes and services use `async def`
- Browser operations use `await`
- Background tasks via `asyncio.create_task()`
- Concurrency control via `asyncio.Semaphore` (module-level state)

### Logging
- Factory: `get_logger("dotted.name")` namespaced under `browser-use.*`
- `configure_logging()` called once at app startup
- Never use `print()` — always `logger.info/warning/error`

### Docstrings
- Google/Sphinx style with `Args:` / `Returns:` blocks
- Module-level docstrings on every file

### Separation of Concerns
- **Routes** = thin controllers (validate, delegate, respond)
- **Services** = orchestration, state management, background tasks
- **Models** = data validation and domain types
- **Parsers** = pure extraction logic (no side effects)
- **Prompts** = pure functions returning prompt strings
- **Constants** = data-only modules (no logic)

## Key Patterns

### Browser Lifecycle
- `create_stealth_browser()` — factory function with lazy `browser_use.Browser` import
- `get_stealth_browser_config()` — returns dict unpacked into Browser constructor
- CDP injection of `STEALTH_JS` via `Page.addScriptToEvaluateOnNewDocument`
- Always `headless=True` in Docker; uses system Chromium (never Playwright browsers)

### LLM Provider Switching
- Default: `ChatOllama(model=..., host="http://ollama:11434")` — native, NOT langchain
- Optional: `ChatOpenAI` (via browser-use import) when `openai_api_key` provided
- Configured in `config.py` via `Settings` class

### Search Orchestration
- Module-level `_active_searches` dict + `_semaphore` (single-process FastAPI)
- `initialize(max_concurrent)` called at lifespan startup
- `start_search()` returns immediately; `_run_search()` runs as background task
- Results POSTed to Next.js callback URL on completion

### Multi-Strategy Parser
- 7 strategies in priority order in `flight_parser.py`
- Key normalization map handles camelCase, abbreviated, GPT-style field names
- Falls back through strategies until one produces valid results

## Dependencies

```
browser-use>=0.11.9        # Browser automation agent
fastapi>=0.115.0           # Web framework
uvicorn[standard]>=0.30.0  # ASGI server
pydantic>=2.0.0            # Data validation
pydantic-settings>=2.0.0   # Environment config
websockets>=12.0           # WebSocket support
httpx>=0.27.0              # Async HTTP client
```

## Gotchas

- browser-use has NO built-in HTTP server — this FastAPI service IS the HTTP wrapper
- `ChatOllama` is native to browser-use (via ollama SDK), NOT langchain's version
- Use `host=` parameter for ChatOllama, NOT `base_url=`
- DO NOT run `playwright install` — system Chromium is pre-installed in Dockerfile
- `shm_size: '2gb'` required in docker-compose for Chromium stability
- All inter-service URLs use Docker service names (e.g., `http://ollama:11434`)
