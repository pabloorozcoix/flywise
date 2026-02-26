# AeroAgent AI — Engineering Specification

> **Single source of truth** documenting the complete AeroAgent AI flight search application as implemented.
> This specification uses **Gherkin syntax** for all acceptance criteria, following spec-driven development practices.
> Reference architecture lives in [README-PLAN.md](README-PLAN.md). Claude Code skill conventions live in [README-SKILLS.md](README-SKILLS.md).

---

## How to Use This Document

This file is designed for autonomous agents or engineers to execute sequentially. The execution loop is:

1. Pick the next task marked `TODO`, respecting any stated prerequisites.
2. Change its status to `IN PROGRESS`.
3. Implement the task, write tests if applicable, and commit the changes.
4. Change the task status to `COMPLETED`.
5. Repeat until all tasks are completed.

---

## Project Status

All **11 epics** are **COMPLETED** (Epics 1–8 core application + Epic 9 browser-service testing + Epic 10 terminate search + Epic 11 frontend testing). The application is fully functional as a 100% local, Docker-based flight search system with comprehensive test coverage.

---

## Architecture Summary

AeroAgent AI is a **four-service Docker Compose application** for automated flight search:

| Service | Tech | Port | Purpose |
|---------|------|------|---------|
| **Next.js** | TypeScript, App Router, Tailwind v4, shadcn/ui | 3000 | Frontend + 16 API routes |
| **Ollama** | qwen3:8b model | 11434 | Local LLM for AI SDK tests + embeddings |
| **browser-use** | Python 3.12, FastAPI, Playwright | 8000 | Browser automation flight scraping |
| **PostgreSQL** | Supabase Postgres 17 + pgvector | 5432 | Persistent storage + vector search |

### Key Architecture Decisions

- **Dual-mode extraction**: The browser-service supports two modes controlled by `EXTRACTION_MODE`: **direct** (default) uses `page.goto()` + `page.evaluate()` to scrape Kayak without any LLM; **agent** uses the browser-use `Agent` class with an LLM (local Ollama or optional OpenAI) for autonomous browsing.
- **Target site**: Kayak (via `build_kayak_url()` URL construction).
- **LLM tracking**: The frontend stores `llm_provider` and `llm_model` in `agent_ctx` for display purposes. In agent mode, the browser-service actively uses the LLM for search execution.
- **Dual-mode progress streaming**: WebSocket primary + HTTP polling fallback for real-time execution updates.
- **Stealth browsing**: Direct mode uses CDP-injected JavaScript; agent mode uses browser-use's built-in stealth features.

---

## Epic 1 — Local Docker Infrastructure

```gherkin
Feature: Local Docker Infrastructure
  As a developer
  I want a fully containerized local development environment
  So that I can run the entire AeroAgent AI stack without cloud dependencies or API keys
```

### US-1.1: Docker Compose Orchestration

**Status**: `COMPLETED`

```gherkin
  Scenario: Four services start on the aeroagent bridge network
    Given a "docker-compose.yml" defining four services
    When the developer runs "docker compose up -d"
    Then the "nextjs" service is available on port 3000
    And the "ollama" service is available on port 11434
    And the "browser-use" service is available on port 8000
    And the "supabase-db" service is available on port 5432
    And all services are connected to the "aeroagent" bridge network

  Scenario: Health checks enforce startup ordering
    Given "nextjs" depends on ollama and supabase-db with condition "service_healthy"
    And "browser-use" depends on ollama with condition "service_healthy"
    When the Docker Compose stack starts
    Then dependent services wait for healthy dependencies before starting
    And ollama health check uses "GET /api/tags"
    And supabase-db health check uses "pg_isready -U postgres"

  Scenario: Development mode with hot reload
    Given a "docker-compose.dev.yml" override file
    When the developer runs "make dev"
    Then frontend source is volume-mounted for Next.js HMR
    And browser-service source is volume-mounted for uvicorn --reload
    And changes to source files trigger automatic reload

  Scenario: Chromium stability in Docker
    Given the browser-use container runs headless Chromium
    When the service processes concurrent browser sessions
    Then the container has "shm_size: 2gb" for shared memory stability
```

**Files**:
- `docker-compose.yml` — Production compose (4 services, named volumes, health checks, startup ordering)
- `docker-compose.dev.yml` — Development override (volume mounts for hot reload, `next dev` + `uvicorn --reload`)
- `frontend/Dockerfile` — Multi-stage: deps → build → runner (node:22-alpine)
- `frontend/Dockerfile.dev` — Single-stage dev (next dev)
- `browser-service/Dockerfile` — python:3.12-slim + system Chromium + uv package manager
- `browser-service/Dockerfile.dev` — Dev build (uvicorn --reload)
- `Makefile` — 32 convenience targets (up, down, build, dev, dev-down, dev-build, dev-logs, shell-*, test-*, lint-*, quality, etc.)

### US-1.2: Environment Configuration

**Status**: `COMPLETED`

```gherkin
  Scenario: Default environment variables for Docker networking
    Given the application runs inside Docker containers
    When services communicate over the "aeroagent" network
    Then OLLAMA_HOST defaults to "http://ollama:11434"
    And BROWSER_USE_API_URL defaults to "http://browser-use:8000"
    And DATABASE_URL defaults to "postgresql://postgres:postgres@supabase-db:5432/postgres"
    And CACHE_TTL_MINUTES defaults to 60
    And EMBEDDING_MODEL defaults to "nomic-embed-text"

  Scenario: Environment template is provided
    Given the project root contains ".env.example"
    When a developer clones the repository
    Then all required environment variables are documented with defaults
```

**Environment variables**:

| Variable | Default (Docker) | Purpose |
|----------|-----------------|---------|
| `OLLAMA_HOST` | `http://ollama:11434` | Ollama API base URL |
| `BROWSER_USE_API_URL` | `http://browser-use:8000` | Browser-use service URL |
| `DATABASE_URL` | `postgresql://postgres:postgres@supabase-db:5432/postgres` | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | `postgres` | Database password |
| `POSTGRES_DB` | `postgres` | Database name |
| `CACHE_TTL_MINUTES` | `60` | Flight result cache TTL |
| `EMBEDDING_MODEL` | `nomic-embed-text` | Ollama model for vector embeddings |

**Files**:
- `.env.example` — Template for all environment variables

---

## Epic 2 — Database Schema & ORM

```gherkin
Feature: Database Schema and ORM
  As a developer
  I want a PostgreSQL database with pgvector support and type-safe ORM access
  So that I can persist search data with vector embeddings for semantic search
```

### US-2.1: PostgreSQL + pgvector Schema

**Status**: `COMPLETED`

```gherkin
  Scenario: pgvector extension is enabled
    Given a fresh PostgreSQL database from "supabase/postgres:17.6.1.081"
    When "supabase/init.sql" runs on first startup
    Then the "vector" extension is created

  Scenario: agent_ctx table stores search parameters
    Given the "agent_ctx" table exists
    When a new flight search is initiated
    Then a row is inserted with origin, destination, departure_date, cabin_class
    And optional fields return_date, direct_only, llm_provider, llm_model have defaults
    And "id" is generated as UUID via gen_random_uuid()

  Scenario: agent_state table tracks execution lifecycle
    Given the "agent_state" table exists with FK to agent_ctx
    When a search execution progresses
    Then "status" is constrained to "pending", "running", "completed", or "failed"
    And "started_at" and "completed_at" timestamps are recorded
    And deleting an agent_ctx cascades to agent_state

  Scenario: memory table stores vector embeddings
    Given the "memory" table exists with FK to agent_ctx
    When a search summary is generated
    Then "embedding" column stores a vector(1536) from Ollama nomic-embed-text
    And "content" stores the human-readable summary text
    And an IVFFlat index on "embedding" enables cosine similarity search

  Scenario: flight_results table stores extracted flights
    Given the "flight_results" table exists with FK to agent_ctx
    When flight data is parsed from Kayak
    Then each result stores airline, departure_time, arrival_time, duration, stops, price
    And "raw_data" JSONB preserves the full extracted data as fallback
    And "verified" defaults to FALSE with nullable "verified_at"
    And deleting an agent_ctx cascades to flight_results

  Scenario: Performance indexes are created
    Given all four tables exist
    Then B-tree indexes exist on agent_state(agent_ctx_id), agent_state(status)
    And B-tree indexes exist on memory(agent_ctx_id), flight_results(agent_ctx_id)
    And an IVFFlat index exists on memory(embedding) with vector_cosine_ops and 100 lists
```

**Tables**: `agent_ctx`, `agent_state`, `memory`, `flight_results`

**Files**:
- `supabase/init.sql` — Complete DDL

### US-2.2: Drizzle ORM Schema

**Status**: `COMPLETED`

```gherkin
  Scenario: TypeScript schema mirrors SQL DDL
    Given "frontend/src/db/schema.ts" defines Drizzle ORM tables
    When the schema is compared to "supabase/init.sql"
    Then all four tables are defined: agentCtx, agentState, memory, flightResults
    And column types, defaults, and constraints match the SQL exactly
    And foreign key cascades match the SQL

  Scenario: Custom pgvector type is defined
    Given Drizzle ORM does not natively support pgvector
    When the schema defines a "vector1536" custom type
    Then it maps to SQL type "vector(1536)"
    And toDriver serializes number[] to string format
    And fromDriver deserializes string back to number[]
```

**Files**:
- `frontend/src/db/schema.ts` — Drizzle ORM table definitions

---

## Epic 3 — Browser-Use Service (Python FastAPI)

```gherkin
Feature: Browser-Use Service
  As an automated flight search system
  I want a Python FastAPI service wrapping Playwright for browser automation
  So that I can scrape flight data from Kayak with stealth capabilities
```

### US-3.1: FastAPI Application Factory

**Status**: `COMPLETED`

```gherkin
  Scenario: App factory creates a configured FastAPI application
    Given "app/main.py" defines the app factory
    When the application starts
    Then a lifespan handler logs startup and shutdown events
    And CORS middleware allows all origins, methods, and headers
    And health, search, and WebSocket routers are registered

  Scenario: Root endpoint confirms service readiness
    Given the FastAPI application is running
    When a client sends "GET /"
    Then the response is {"service": "browser-use", "status": "ready"}
```

**Files**:
- `app/main.py` — FastAPI app factory
- `app/__init__.py` — Package init

### US-3.2: Configuration

**Status**: `COMPLETED`

```gherkin
  Scenario: Settings load from environment with sensible defaults
    Given "app/config.py" defines a pydantic-settings BaseSettings class
    When get_settings() is called
    Then ollama_host defaults to "http://ollama:11434"
    And ollama_model defaults to "qwen3:8b"
    And openai_model defaults to "gpt-4.1-mini"
    And openai_api_key defaults to empty string
    And extraction_mode defaults to "direct"
    And agent_max_steps defaults to 10
    And agent_max_failures defaults to 3
    And nextjs_callback_url defaults to "http://nextjs:3000/api/callback/search-complete"
    And max_concurrent_searches defaults to 3

  Scenario: Settings are cached as a singleton
    Given get_settings() uses @lru_cache
    When called multiple times
    Then the same Settings instance is returned
```

**Files**:
- `app/config.py` — Settings class

### US-3.3: Structured Logging

**Status**: `COMPLETED`

```gherkin
  Scenario: Logging is configured with structured format
    Given "app/logger.py" defines configure_logging()
    When the logging system is initialized
    Then the log format is "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"

  Scenario: Namespaced child loggers are created
    Given configure_logging() has been called
    When get_logger("search") is called
    Then a child logger named "search" is returned
    And it inherits the root logging configuration
```

**Files**:
- `app/logger.py` — Logging configuration

### US-3.4: Pydantic Domain Models

**Status**: `COMPLETED`

```gherkin
  Scenario: Enum models define valid values
    Given "app/models/enums.py" defines string enums
    Then CabinClass contains "economy", "business", "first"
    And SearchStatusValue contains "pending", "running", "completed", "failed", "cancelled"

  Scenario: Domain models represent core entities
    Given "app/models/domain.py" defines Pydantic models
    Then FlightResult has fields: airline, departure_time, arrival_time, duration, stops, price, currency, url
    And ProgressEvent has fields: step, message, timestamp, screenshot_base64
    And SearchStatus has fields: search_id, status, progress_events, results, error

  Scenario: Request model validates search input
    Given "app/models/requests.py" defines FlightSearchRequest
    Then it requires origin, destination, departure_date, cabin_class
    And optional fields include return_date, direct_only, openai_api_key, search_id, callback_url

  Scenario: Response models define API contracts
    Given "app/models/responses.py" defines response models
    Then HealthResponse has status field
    And SearchResponse has search_id and status fields
    And StatusResponse includes status, progress_events, results, and error
```

**Files**:
- `app/models/__init__.py`, `app/models/enums.py`, `app/models/domain.py`, `app/models/requests.py`, `app/models/responses.py`

### US-3.5: Routes

**Status**: `COMPLETED`

```gherkin
  Scenario: Health endpoint returns status
    Given the browser-use service is running
    When a client sends "GET /health"
    Then the response is {"status": "ok"}

  Scenario: Search endpoint starts a background task
    Given a valid FlightSearchRequest body
    When a client sends "POST /search"
    Then an asyncio background task is created for _run_search()
    And the response is {"search_id": "<uuid>", "status": "running"}
    And the response is returned immediately without waiting for search completion

  Scenario: Status endpoint returns current search state
    Given a search with ID "abc-123" is active
    When a client sends "GET /status/abc-123"
    Then the response includes status, progress_events array, results, and error

  Scenario: WebSocket streams real-time progress
    Given a search with ID "abc-123" is active
    When a client connects to "WS /ws/search/abc-123"
    Then progress events are streamed as they occur
    And the WebSocket polls _active_searches every 10 seconds
    And last_sent_index prevents duplicate event delivery
    And the connection closes on completion, failure, or cancellation
```

**Files**:
- `app/routes/__init__.py`, `app/routes/health.py`, `app/routes/search.py`, `app/routes/websocket.py`

### US-3.6: Search Service (Core Pipeline)

**Status**: `COMPLETED`

```gherkin
  Scenario: Search pipeline dispatches based on extraction mode
    Given a FlightSearchRequest with origin "JFK", destination "LAX", date "2025-03-15"
    When _run_search() executes
    Then it reads EXTRACTION_MODE from config
    And dispatches to _run_search_direct() if mode is "direct"
    And dispatches to _run_search_agent() if mode is "agent"

  Scenario: Direct mode pipeline executes browser automation
    Given EXTRACTION_MODE is "direct"
    When _run_search_direct() executes the pipeline
    Then Step 0 creates a stealth browser via create_stealth_browser()
    And Step 1 builds the Kayak URL via build_kayak_url()
    And Step 2 navigates to the URL and waits 15 seconds for results
    And Step 3 extracts flight data via page.evaluate(EXTRACTION_JS)
    And Step 4 parses results via _parse_extraction() using text_parser
    And Step 5 stores results and notifies the callback

  Scenario: Agent mode pipeline uses LLM-driven browsing
    Given EXTRACTION_MODE is "agent"
    When _run_search_agent() executes the pipeline
    Then Step 0 creates an agent browser via create_agent_browser() with library stealth
    And Step 1 pre-navigates to the Kayak URL
    And Step 2 builds the task prompt via build_flight_search_prompt()
    And Step 3 creates an LLM via _create_llm() (ChatOllama or ChatOpenAI)
    And Step 4 runs the Agent with on_step_start callback for progress streaming
    And Step 5 parses results through 7-strategy flight_parser.py pipeline
    And Step 6 stores results and notifies the callback

  Scenario: LLM factory selects provider based on configuration
    Given _create_llm() is called
    When OPENAI_API_KEY is set
    Then ChatOpenAI is returned with the configured OPENAI_MODEL
    When OPENAI_API_KEY is empty
    Then ChatOllama is returned with the configured OLLAMA_MODEL and OLLAMA_HOST

  Scenario: Concurrent searches are limited by semaphore
    Given max_concurrent_searches is set to 3
    When a 4th concurrent search is requested
    Then it waits for the semaphore before proceeding

  Scenario: Progress events are tracked in module-level state
    Given _active_searches dict stores SearchStatus objects
    When each pipeline step completes
    Then a ProgressEvent is appended with step number, message, and optional screenshot

  Scenario: Search failure is handled gracefully
    Given the pipeline encounters an error
    When the exception is caught
    Then status is set to "failed" with error message
    And the callback is notified with status "failed"
    And the browser is always closed in the finally block
```

**Files**:
- `app/services/search.py` — Core search pipeline + `_active_searches` state
- `app/services/__init__.py`

### US-3.7: Browser Service

**Status**: `COMPLETED`

```gherkin
  Scenario: Stealth browser is created with anti-detection measures (direct mode)
    Given create_stealth_browser() is called
    When Playwright launches headless Chromium
    Then STEALTH_JS is injected via CDP Page.addScriptToEvaluateOnNewDocument
    And a random user-agent is selected from the USER_AGENTS list

  Scenario: Agent browser is created with library-level stealth (agent mode)
    Given create_agent_browser() is called
    When browser-use launches headless Chromium
    Then the library's built-in stealth features are applied
    And BrowserConfig uses headless=True and disable_security=True

  Scenario: Full-page screenshots are captured
    Given a Playwright page is open
    When take_screenshot(page) is called
    Then a full-page screenshot is returned as a base64 string

  Scenario: Browser cleanup handles errors gracefully
    Given an open browser and context
    When close_browser(browser, context) is called
    Then context is closed first, then browser
    And errors during cleanup are caught and logged
```

**Files**:
- `app/services/browser.py` — Browser lifecycle management

### US-3.8: Callback Service

**Status**: `COMPLETED`

```gherkin
  Scenario: Successful search completion is reported
    Given a search completes with flight results
    When notify_callback() is called with status "completed"
    Then an async HTTP POST is sent to the nextjs_callback_url
    And the payload includes search_id, status, and results array

  Scenario: Failed search is reported
    Given a search fails with an error
    When notify_callback() is called with status "failed"
    Then an async HTTP POST is sent with the error message

  Scenario: Callback failure is non-blocking
    Given the callback endpoint is unreachable
    When notify_callback() fails
    Then a warning is logged
    And the search pipeline continues without raising
    And the request has a 10-second timeout
```

**Files**:
- `app/services/callback.py` — Callback notification

### US-3.9: Stealth Constants

**Status**: `COMPLETED`

```gherkin
  Scenario: User agent rotation is available
    Given USER_AGENTS is defined in "app/constants/stealth.py"
    Then it contains 5 realistic Chrome user-agent strings
    And a random one is selected for each browser session

  Scenario: Stealth JavaScript evades bot detection
    Given STEALTH_JS is defined in "app/constants/stealth.py"
    When injected into the browser via CDP
    Then navigator.webdriver is overridden to return undefined
    And navigator.plugins reports realistic plugin data
    And navigator.languages reports ["en-US", "en"]
    And chrome.runtime is defined
    And Notification.permission reports "default"
    And navigator.permissions.query is patched
```

**Files**:
- `app/constants/stealth.py` — User agents + stealth overrides
- `app/constants/__init__.py`

### US-3.10: DOM Extraction JavaScript

**Status**: `COMPLETED`

```gherkin
  Scenario: Flight data is extracted from Kayak DOM
    Given EXTRACTION_JS is defined in "app/constants/selectors.py"
    When executed via page.evaluate() on a Kayak results page
    Then it queries all elements matching '[class*="resultInner"]'
    And extracts airline, price, departure/arrival times, duration, stops from each card
    And returns a JSON string array of flight result objects

  Scenario: Fallback extraction when no structured results found
    Given EXTRACTION_JS runs on a page without result cards
    When no '[class*="resultInner"]' elements are found
    Then it falls back to returning document.body.innerText
```

**Files**:
- `app/constants/selectors.py` — `EXTRACTION_JS` constant

### US-3.11: Text Parser (Active)

**Status**: `COMPLETED`

```gherkin
  Scenario: Raw text is parsed into FlightResult objects
    Given raw extraction output containing flight information
    When try_parse_plain_text_flights() processes the text
    Then it first attempts JSON parsing via json.loads
    And falls back to fix_malformed_json() from json_fixer
    And finally falls back to regex-based parsing via parse_raw_text_to_flight()

  Scenario: Regex parser extracts flight fields
    Given a text block like "Delta 6:25 pm – 9:30 pm 5h 05m Nonstop $299"
    When parse_raw_text_to_flight() processes the block
    Then it extracts airline "Delta"
    And departure time "6:25 pm", arrival time "9:30 pm"
    And duration "5h 05m", stops 0, price 299.0

  Scenario: Multiple flights are parsed from boundary-split text
    Given raw text containing multiple flight blocks
    When try_parse_plain_text_flights() splits by flight-like boundaries
    Then each block is parsed individually
    And a list of FlightResult objects is returned
```

**Files**:
- `app/parsers/text_parser.py` — Active text parser
- `app/parsers/__init__.py`

### US-3.12: JSON Fixer

**Status**: `COMPLETED`

```gherkin
  Scenario: Malformed JSON is repaired
    Given DOM extraction returns JSON with common issues
    When fix_malformed_json() processes the text
    Then trailing commas are removed
    And unquoted keys are quoted
    And the result is valid JSON

  Scenario: Multiple JSON objects are extracted from unstructured text
    Given text containing multiple JSON objects without array wrapping
    When extract_individual_objects() processes the text
    Then individual JSON objects are identified and extracted
    And each is returned as a separate parsed object
```

**Files**:
- `app/parsers/json_fixer.py` — JSON repair utilities

### US-3.13: Kayak URL Builder (Active)

**Status**: `COMPLETED`

```gherkin
  Scenario: Kayak search URL is constructed with all parameters
    Given origin "JFK", destination "LAX", date "2025-03-15"
    And cabin_class "business" and direct_only true
    When build_kayak_url() is called
    Then the URL contains "/flights/JFK-LAX/2025-03-15"
    And the cabin class is mapped to Kayak's format
    And the nonstop filter is applied
    And sort-by-price parameter is included
```

**Files**:
- `app/prompts/kayak.py` — `build_kayak_url()` function (actively used)

### US-3.14: Dual-Mode Agent Architecture

**Status**: `COMPLETED`

```gherkin
  Scenario: Modules are active in agent mode
    Given EXTRACTION_MODE is set to "agent"
    Then "app/parsers/flight_parser.py" is used for 7-strategy result extraction
    And "app/prompts/kayak.py::build_flight_search_prompt()" generates the Agent task prompt
    And "app/prompts/extraction.py::build_extraction_prompt()" provides structured output schema
    And "app/models/domain.py::FlightResultsOutput" is the Agent output model
    And all modules are covered by unit tests

  Scenario: Modules are bypassed in direct mode
    Given EXTRACTION_MODE is set to "direct" (default)
    Then the search pipeline uses text_parser.py and EXTRACTION_JS instead
    And flight_parser.py, build_flight_search_prompt(), and build_extraction_prompt() are not called
```

| File | Agent Mode Role | Direct Mode |
|------|----------------|-------------|
| `app/parsers/flight_parser.py` | 7-strategy multi-parser for Agent history extraction | Not used |
| `app/prompts/kayak.py` | `build_flight_search_prompt()` generates Agent task prompt | Only `build_kayak_url()` is used |
| `app/prompts/extraction.py` | `build_extraction_prompt()` provides structured output schema | Not used |
| `app/models/domain.py` | `FlightResultsOutput` is the Agent output model | Not used |

---

## Epic 4 — Next.js Frontend (Pages & Layout)

```gherkin
Feature: Next.js Frontend Pages and Layout
  As a user
  I want a polished dark-themed flight search UI with real-time tracking
  So that I can search for flights, monitor agent progress, and view results
```

### US-4.1: Root Layout & Theme

**Status**: `COMPLETED`

```gherkin
  Scenario: Dark theme is applied by default
    Given the root layout wraps the app in ThemeProvider
    When a user visits any page
    Then the default theme is "dark"
    And the theme attribute is set on the HTML class

  Scenario: Layout renders navigation and footer
    Given the root layout is defined in "app/layout.tsx"
    When any page is rendered
    Then the Navbar appears at the top
    And the Footer appears at the bottom
    And the Inter font from Google Fonts is applied

  Scenario: Tailwind CSS v4 is configured via CSS-first approach
    Given "globals.css" imports Tailwind v4
    Then it uses '@import "tailwindcss"' and '@import "tw-animate-css"'
    And dark mode uses '@custom-variant dark (&:where(.dark, .dark *))'
    And custom CSS properties define brand colors and glass morphism effects
```

**Files**:
- `frontend/src/app/layout.tsx` — Root layout
- `frontend/src/app/globals.css` — Global styles + Tailwind v4 config
- `frontend/src/components/theme-provider.tsx` — ThemeProvider wrapper
- `frontend/src/components/theme-toggle.tsx` — Theme toggle button

### US-4.2: Home Page

**Status**: `COMPLETED`

```gherkin
  Scenario: Home page displays hero and search form
    Given a user navigates to "/"
    When the home page renders
    Then a hero section with gradient text is displayed
    And the SearchForm component is rendered for flight search input
    And a features grid highlights AI search, stealth automation, tracking, and vector memory

  Scenario: Search form submission triggers API call and redirect
    Given a user fills out the SearchForm with valid data
    When the form is submitted
    Then useFlightSearch() sends POST to "/api/search"
    And the user is redirected to "/history/{searchId}"
```

**Files**:
- `frontend/src/app/page.tsx` — Home page

### US-4.3: Execution Page (`/history/[id]`)

**Status**: `COMPLETED`

```gherkin
  Scenario: Real-time execution monitoring via WebSocket
    Given a user navigates to "/history/{searchId}"
    When useSearchExecution(searchId) initializes
    Then a WebSocket connects to "ws://browser-use:8000/ws/search/{id}"
    And progress events are rendered in the ExecutionTimeline
    And an AgentStatus badge shows the current state

  Scenario: HTTP polling fallback when WebSocket fails
    Given the WebSocket connection fails
    When the hook detects the error
    Then it falls back to polling "GET /status/{id}" every 10 seconds
    And then falls back to "GET /api/status/{id}" (DB-backed)

  Scenario: LLM provider badge displays model info
    Given the agent_ctx record stores llm_provider and llm_model
    When the execution page renders
    Then a badge shows "ollama • qwen3:8b" or "openai • gpt-4.1-mini"

  Scenario: View Results button appears on completion
    Given the search status changes to "completed"
    When results are available
    Then a "View Results" button links to "/results/{id}"
    And an Agent Output panel shows collapsible raw JSON with copy button
```

**Files**:
- `frontend/src/app/history/[id]/page.tsx` — Execution page

### US-4.4: Results Page (`/results/[id]`)

**Status**: `COMPLETED`

```gherkin
  Scenario: Flight results are displayed with sort and filter
    Given a user navigates to "/results/{searchId}"
    When results are fetched from "GET /api/results/{id}"
    Then FlightCard components render each result in a grid
    And results are sorted by Price ascending by default

  Scenario: User sorts results by different fields
    Given flight results are displayed
    When the user selects "Duration" sort
    Then results are re-ordered using parseDurationMinutes() (e.g., "7h 30m" → 450)
    When the user selects "Departure" sort
    Then results are re-ordered by departure time

  Scenario: User filters for direct flights only
    Given flight results include both direct and connecting flights
    When the user toggles "Direct flights only"
    Then only flights with 0 stops are displayed

  Scenario: Search summary header displays context
    Given results are loaded
    Then the header shows origin → destination, date, cabin class, and LLM provider

  Scenario: Empty state is shown when no results match
    Given no results exist or all are filtered out
    When the results page renders
    Then an empty state message is displayed
```

**Files**:
- `frontend/src/app/results/[id]/page.tsx` — Results page

### US-4.5: Settings Page

**Status**: `COMPLETED`

```gherkin
  Scenario: Four service connectivity tabs are available
    Given a user navigates to "/settings"
    When the settings page renders
    Then 4 tabbed panels are displayed: Ollama, Database, Browser-Use, System

  Scenario: Ollama connection test streams AI response
    Given the user clicks "Test" on the Ollama tab
    When useOllamaConnectionTest calls "GET /api/ai/ollama-test"
    Then a streaming response confirms Ollama is operational
    And the status badge shows "Connected" or "Error"

  Scenario: Database connection test verifies PostgreSQL and pgvector
    Given the user clicks "Test" on the Database tab
    When useDatabaseConnectionTest calls the DB test endpoints
    Then "GET /api/db/test-connection" verifies PostgreSQL connectivity
    And "GET /api/db/test-pgvector" verifies pgvector operations

  Scenario: Browser-Use health test checks service availability
    Given the user clicks "Test" on the Browser-Use tab
    When useBrowserUseHealthTest calls "GET /api/browser-use/health"
    Then the status badge shows "Healthy" or "Error"

  Scenario: System status aggregates all service health
    Given the user clicks "Test" on the System tab
    When useSystemStatus calls "GET /api/system/status"
    Then health status with latency is shown for each service
    And row counts for all 4 application tables are displayed
```

**Files**:
- `frontend/src/app/settings/page.tsx` — Settings wrapper page
- `frontend/src/components/settings/index.tsx` — Settings tabs component
- `frontend/src/components/settings/components/OllamaConnectionTest/index.tsx`
- `frontend/src/components/settings/components/OllamaConnectionTest/hooks/useOllamaConnectionTest.ts`
- `frontend/src/components/settings/components/DatabaseConnectionTest/index.tsx`
- `frontend/src/components/settings/components/DatabaseConnectionTest/hooks/useDatabaseConnectionTest.ts`
- `frontend/src/components/settings/components/BrowserUseHealthTest/index.tsx`
- `frontend/src/components/settings/components/BrowserUseHealthTest/hooks/useBrowserUseHealthTest.ts`
- `frontend/src/components/settings/components/SystemStatus/index.tsx`
- `frontend/src/components/settings/components/SystemStatus/hooks/useSystemStatus.ts`

### US-4.6: Credits Page (`/credits`)

**Status**: `COMPLETED`

```gherkin
  Scenario: Credits page displays features and team
    Given a user navigates to "/credits"
    When the static server component renders
    Then a page header shows "Credits" with description
    And 8 feature blocks with Lucide icons highlight capabilities
    And a team roster grid displays 5 team members with name and role
```

**Files**:
- `frontend/src/app/credits/page.tsx` — Credits page

### US-4.7: History List Page (`/history`)

**Status**: `COMPLETED`

```gherkin
  Scenario: Execution history is displayed in a data table
    Given a user navigates to "/history"
    When the page fetches "GET /api/executions" on mount
    Then the ExecutionsTable component renders all past search executions
    And a "Back to Search" button links to the home page

  Scenario: Executions can be deleted
    Given the executions table displays rows
    When the user clicks delete on an execution
    Then "DELETE /api/executions/[id]" is called
    And the execution and all related data are cascade-deleted

  Scenario: Loading and error states are handled
    Given the page is fetching execution data
    When the request is in progress
    Then a skeleton loading state is displayed
    When the request fails
    Then an error message is displayed
```

**Files**:
- `frontend/src/app/history/page.tsx` — History list page

### US-4.8: Results Redirect Page (`/results`)

**Status**: `COMPLETED`

```gherkin
  Scenario: Legacy route redirects to history
    Given a user navigates to "/results"
    When the server component renders
    Then the user is redirected to "/history"
    And query string parameters are preserved
```

**Files**:
- `frontend/src/app/results/page.tsx` — Redirect page

---

## Epic 5 — Next.js API Routes

```gherkin
Feature: Next.js API Routes
  As the frontend application
  I want 16 REST and streaming API routes
  So that I can orchestrate search, persist data, proxy services, and serve results
```

### US-5.1: Health Check

**Status**: `COMPLETED`

```gherkin
  Scenario: App health check returns OK
    Given the Next.js server is running
    When a client sends "GET /api/health"
    Then the response is { status: "ok", timestamp: "<ISO string>" }
    And the Docker health check uses this endpoint
```

**Files**:
- `frontend/src/app/api/health/route.ts`

### US-5.2: Search Trigger

**Status**: `COMPLETED`

```gherkin
  Scenario: Search is initiated with Ollama provider
    Given a valid search request without an OpenAI API key
    When a client sends "POST /api/search" with origin, destination, departureDate, cabinClass
    Then an agent_ctx row is created with llm_provider "ollama" and llm_model "qwen3:8b"
    And an agent_state row is created with status "running" and started_at NOW()
    And a fire-and-forget POST is sent to browser-use "/search"
    And the response is { searchId: "<uuid>", status: "running" }

  Scenario: Search is initiated with OpenAI provider
    Given a valid search request with an openaiApiKey field
    When a client sends "POST /api/search"
    Then agent_ctx stores llm_provider "openai" and llm_model "gpt-4.1-mini"

  Scenario: Cached search result is returned
    Given a completed search exists within CACHE_TTL_MINUTES for the same parameters
    And no OpenAI API key is provided
    When a client sends "POST /api/search" with matching parameters
    Then the cached searchId is returned with status "completed"
    And no new browser-use request is triggered
```

**Files**:
- `frontend/src/app/api/search/route.ts`

### US-5.3: Results Retrieval

**Status**: `COMPLETED`

```gherkin
  Scenario: Flight results are fetched by search ID
    Given a search with ID "abc-123" has completed with results
    When a client sends "GET /api/results/abc-123"
    Then the response includes searchId, status, searchParams, llm provider/model
    And results array is sorted by price ascending
    And each result includes airline, departure, arrival, duration, stops, price, url

  Scenario: Fallback to raw_data when timestamps are null
    Given flight_results have null departure_time or arrival_time columns
    When results are fetched
    Then the API falls back to raw_data JSONB for time values
    And handles "6:25 pm" style time strings
```

**Files**:
- `frontend/src/app/api/results/[id]/route.ts`

### US-5.4: Status Polling

**Status**: `COMPLETED`

```gherkin
  Scenario: Search status is polled from database
    Given a search with ID "abc-123" is running
    When a client sends "GET /api/status/abc-123"
    Then the response includes status, error, startedAt, completedAt

  Scenario: Completed status includes flight results
    Given a search with ID "abc-123" has completed
    When a client sends "GET /api/status/abc-123"
    Then the response also includes the flight results array
```

**Files**:
- `frontend/src/app/api/status/[id]/route.ts`

### US-5.5: Search Completion Callback

**Status**: `COMPLETED`

```gherkin
  Scenario: Successful search results are persisted
    Given browser-use sends a callback with status "completed"
    When "POST /api/callback/search-complete" is received
    Then each flight result is inserted into flight_results table
    And tryParseTimestamp() handles time value parsing
    And agent_state is updated to "completed" with completed_at

  Scenario: Search summary embedding is generated
    Given search results have been persisted
    When the callback handler generates a summary
    Then generateEmbedding() creates a vector via Ollama nomic-embed-text
    And a memory entry is stored with content and embedding vector
    And if Ollama is unavailable, the memory is stored without embedding

  Scenario: Failed search is recorded
    Given browser-use sends a callback with status "failed"
    When "POST /api/callback/search-complete" is received
    Then agent_state is updated to "failed" with the error message
    And a failure summary memory entry is stored with embedding attempt
```

**Files**:
- `frontend/src/app/api/callback/search-complete/route.ts`

### US-5.6: Ollama AI Test

**Status**: `COMPLETED`

```gherkin
  Scenario: Streaming Ollama test confirms connectivity
    Given the Ollama service is running with qwen3:8b
    When a client sends "GET /api/ai/ollama-test"
    Then streamText() sends a brief operational prompt to the model
    And the response is a streaming text response via toTextStreamResponse()
```

**Files**:
- `frontend/src/app/api/ai/ollama-test/route.ts`

### US-5.7: Browser-Use Health Proxy

**Status**: `COMPLETED`

```gherkin
  Scenario: Browser-use health is proxied
    Given the browser-use service is running
    When a client sends "GET /api/browser-use/health"
    Then the API fetches "GET {BROWSER_USE_API_URL}/health" with a 5-second timeout
    And returns { status: "ok", serviceStatus: "...", url: "..." }
```

**Files**:
- `frontend/src/app/api/browser-use/health/route.ts`

### US-5.8: Database Connection Test

**Status**: `COMPLETED`

```gherkin
  Scenario: PostgreSQL connection is verified
    Given the Supabase PostgreSQL database is running
    When a client sends "GET /api/db/test-connection"
    Then the API connects via pg.Client and executes "SELECT version()" via Drizzle ORM
    And returns { status: "connected", version: "PostgreSQL 17..." }
```

**Files**:
- `frontend/src/app/api/db/test-connection/route.ts`

### US-5.9: pgvector Extension Test

**Status**: `COMPLETED`

```gherkin
  Scenario: pgvector operations are verified
    Given the vector extension is installed
    When a client sends "GET /api/db/test-pgvector"
    Then the API checks pg_extension for the vector extension
    And creates a temp table, inserts test vectors, performs a distance query
    And returns { status: "pgvector_active", pgvectorVersion, test: { nearestId, distance } }
```

**Files**:
- `frontend/src/app/api/db/test-pgvector/route.ts`

### US-5.10: Memory Storage

**Status**: `COMPLETED`

```gherkin
  Scenario: Agent memory is stored with embedding
    Given a client sends "POST /api/memory" with { agent_ctx_id, content, step_number? }
    When generateEmbedding(content) produces a vector from Ollama
    Then the memory entry is inserted with content and embedding vector

  Scenario: Memory is stored without embedding on failure
    Given Ollama embedding generation fails
    When the memory storage is attempted
    Then the memory is stored with null embedding as fallback
```

**Files**:
- `frontend/src/app/api/memory/route.ts`

### US-5.11: Semantic Memory Search

**Status**: `COMPLETED`

```gherkin
  Scenario: Vector similarity search over agent memory
    Given memory entries exist with vector embeddings
    When a client sends "GET /api/memory/search?q=cheapest+flight&limit=10"
    Then the API generates an embedding for the query text
    And performs cosine similarity search using the "<=>" operator
    And JOINs with agent_ctx for search context
    And returns { query, count, memories[] } with similarity scores
    And the maximum limit is 50 results
```

**Files**:
- `frontend/src/app/api/memory/search/route.ts`

### US-5.12: System Status

**Status**: `COMPLETED`

```gherkin
  Scenario: Aggregate health check reports all service states
    Given the system status endpoint is called
    When a client sends "GET /api/system/status"
    Then Ollama health is checked via "GET /api/tags"
    And Browser-Use health is checked via "GET /health"
    And PostgreSQL health is checked via pool connect
    And each service reports health status with latency measurement
    And row counts for all 4 application tables are included
    And overall status is "healthy" or "degraded"
```

**Files**:
- `frontend/src/app/api/system/status/route.ts`

### US-5.13: Flight Result Verification (Stub)

**Status**: `COMPLETED`

```gherkin
  Scenario: Verification stub marks result as verified
    Given a flight result with ID exists in the database
    When a client sends "POST /api/verify/{id}"
    Then the flight_results row is updated with verified = TRUE and verified_at = NOW()
    And the response includes { id, verified: true, verifiedAt, message } with a stub notice
    And production would re-scrape the booking URL and cross-reference sources
```

**Files**:
- `frontend/src/app/api/verify/[id]/route.ts`

### US-5.14: Executions List

**Status**: `COMPLETED`

```gherkin
  Scenario: All search executions are listed for history
    Given search executions exist in the database
    When a client sends "GET /api/executions"
    Then agent_ctx and agent_state are JOINed with a flight_results count subquery
    And the response includes { executions[] } with search params, status, timestamps, result count
    And results are ordered by created_at descending
```

**Files**:
- `frontend/src/app/api/executions/route.ts`

### US-5.15: Execution Delete

**Status**: `COMPLETED`

```gherkin
  Scenario: Execution is deleted with cascade
    Given an execution with ID "abc-123" exists
    When a client sends "DELETE /api/executions/abc-123"
    Then the agent_ctx row is deleted
    And FK cascades delete related agent_state, memory, and flight_results rows
    And the response is { deleted: true, id: "abc-123" }

  Scenario: Delete returns 404 for unknown execution
    Given no execution with ID "unknown" exists
    When a client sends "DELETE /api/executions/unknown"
    Then the response status is 404
```

**Files**:
- `frontend/src/app/api/executions/[id]/route.ts`

### API Routes Summary

| # | Method | Route | Purpose |
|---|--------|-------|---------|
| 1 | GET | `/api/health` | App health check |
| 2 | POST | `/api/search` | Initiate flight search |
| 3 | GET | `/api/results/[id]` | Fetch search results |
| 4 | GET | `/api/status/[id]` | Poll search status |
| 5 | POST | `/api/callback/search-complete` | Browser-use completion callback |
| 6 | GET | `/api/ai/ollama-test` | Streaming Ollama test |
| 7 | GET | `/api/browser-use/health` | Browser-use health proxy |
| 8 | GET | `/api/db/test-connection` | Database connection test |
| 9 | GET | `/api/db/test-pgvector` | pgvector extension test |
| 10 | POST | `/api/memory` | Store memory with embedding |
| 11 | GET | `/api/memory/search` | Semantic memory search |
| 12 | GET | `/api/system/status` | Aggregate system status |
| 13 | POST | `/api/verify/[id]` | Verification stub |
| 14 | POST | `/api/search/[id]/cancel` | Cancel/terminate running search |
| 15 | GET | `/api/executions` | List all search executions |
| 16 | DELETE | `/api/executions/[id]` | Delete execution + cascade |

**Total: 16 API routes**

---

## Epic 6 — Frontend Components

```gherkin
Feature: Frontend Components
  As a user
  I want polished, interactive UI components
  So that I can search for flights, view results, and monitor agent progress
```

### US-6.1: SearchForm

**Status**: `COMPLETED`

```gherkin
  Scenario: Form renders all required fields
    Given the SearchForm component is mounted
    Then it displays fields for Origin, Destination, Departure Date, Return Date
    And a Cabin Class select with economy/business/first options
    And a Direct Only toggle switch

  Scenario: Date pickers prevent past date selection
    Given the Departure Date field is clicked
    When the Calendar popover opens
    Then dates before today are disabled

  Scenario: Advanced options section is collapsible
    Given the form renders
    When the user expands "Advanced Options"
    Then an OpenAI API Key password field appears with "sk-..." placeholder

  Scenario: Form validates input with Zod schema
    Given the user submits the form with invalid data
    When react-hook-form + Zod validation runs
    Then validation error messages are displayed via FormMessage components

  Scenario: Successful submission calls onSubmit with validated data
    Given the user fills all required fields with valid data
    When the form is submitted
    Then onSubmit(data) is called with a validated FlightSearchParams object
    And the submit button shows a loading spinner during submission
```

**Files**:
- `frontend/src/components/SearchForm/SearchForm.tsx` — Form component
- `frontend/src/components/SearchForm/types.ts` — Props interface
- `frontend/src/components/SearchForm/hooks/useFlightSearch.ts` — Submit handler hook (POST → redirect)
- `frontend/src/components/SearchForm/index.ts` — Barrel export

### US-6.2: FlightCard

**Status**: `COMPLETED`

```gherkin
  Scenario: Flight card displays all flight information
    Given a FlightCard component receives flight data
    Then it shows airline name and origin/destination codes
    And departure → arrival times with animated route line and stop indicator
    And flight duration and stops badge ("Non-stop" or "X stops")
    And price with currency symbol and ".00" suffix

  Scenario: Rank badges are displayed for top results
    Given a flight has rank 1
    Then a "Best Value" badge (purple) is displayed
    Given a flight has rank 2
    Then a "Cheapest" badge (green) is displayed

  Scenario: Verification badge indicates trust level
    Given a flight has verified = true
    Then a ShieldCheck icon (green) is displayed
    Given a flight has verified = false
    Then a ShieldAlert icon (gray) is displayed

  Scenario: Time formatting handles multiple formats
    Given departure_time may be ISO date or plain time string
    When safeFormatTime() processes the value
    Then both "2025-03-15T18:25:00Z" and "6:25 pm" are displayed correctly
```

**Files**:
- `frontend/src/components/FlightCard/FlightCard.tsx` — Card component
- `frontend/src/components/FlightCard/types.ts` — Props interface (`FlightCardProps`)
- `frontend/src/components/FlightCard/index.ts` — Barrel export

### US-6.3: ExecutionTimeline

**Status**: `COMPLETED`

```gherkin
  Scenario: Timeline renders events with visual indicators
    Given the ExecutionTimeline receives an array of agent events
    Then a vertical line connects event nodes with type-specific icons
    And "status" events show shield icons
    And "progress" events show brain/globe icons
    And "done" events show check circle icons
    And "error" events show alert circle icons

  Scenario: Active progress events have visual emphasis
    Given a progress event is the latest event
    Then it displays a gradient glow effect
    When subsequent events arrive
    Then the previous event gets a purple border (completed look)

  Scenario: Event details are expandable
    Given an event has additional data (thinking, evaluation, memory, actions)
    When the user expands the event
    Then thinking details are shown in purple
    And evaluation in amber, memory in cyan, actions in orange JSON
    And screenshots are displayed if present

  Scenario: Auto-scroll follows latest events
    Given new events arrive in the timeline
    Then the view automatically scrolls to the latest event via ref

  Scenario: Loading state shows spinner
    Given no events have arrived yet
    Then a spinner with "Waiting for agent to start..." is displayed
```

**Files**:
- `frontend/src/components/ExecutionTimeline/ExecutionTimeline.tsx` — Timeline component
- `frontend/src/components/ExecutionTimeline/types.ts` — Props interface
- `frontend/src/components/ExecutionTimeline/hooks/useSearchExecution.ts` — WebSocket + polling hook
- `frontend/src/components/ExecutionTimeline/index.ts` — Barrel export

### US-6.4: useSearchExecution Hook

**Status**: `COMPLETED`

```gherkin
  Scenario: WebSocket connection is primary transport
    Given useSearchExecution(searchId) is called
    When the hook initializes
    Then a WebSocket connects to "ws://{hostname}:8000/ws/search/{searchId}"
    And it handles "status", "progress", "done", "error" event types
    And progress events may include screenshot, thinking, evaluation, memory, actions

  Scenario: React StrictMode safety with wsIdRef
    Given React StrictMode causes double-mount
    When the component re-mounts
    Then wsIdRef detects and discards stale WebSocket callbacks

  Scenario: HTTP polling activates as fallback
    Given the WebSocket connection fails
    When polling activates after 3-second initial delay
    Then "GET http://{hostname}:8000/status/{searchId}" is polled every 10 seconds
    And falls back to "GET /api/status/{searchId}" (Next.js DB-backed)
    And polledProgressCountRef prevents duplicate events
    And polling skips when WebSocket is actively delivering data (wsDeliveredRef)

  Scenario: State management tracks execution lifecycle
    Given the hook manages SearchExecutionState
    Then state includes status, events[], error?, and results?
    And status transitions through "idle" → "connecting" → "running" → "completed"|"error"|"cancelled"
```

**Files**:
- `frontend/src/components/ExecutionTimeline/hooks/useSearchExecution.ts`

### US-6.5: AgentStatus

**Status**: `COMPLETED`

```gherkin
  Scenario Outline: Status badge renders correct state
    Given the agent is in "<state>" state
    When the AgentStatus component renders
    Then the icon is "<icon>"
    And the badge color is "<color>"
    And additional content is "<extra>"

    Examples:
      | state      | icon            | color        | extra                        |
      | idle       | WifiOff         | gray         |                              |
      | connecting | Spinning Loader | amber        |                              |
      | running    | Spinning Loader | electric blue| ping dot animation           |
      | completed  | CheckCircle2    | emerald      | result count                 |
      | error      | AlertCircle     | red          | error message + Retry button |
```

**Files**:
- `frontend/src/components/AgentStatus/AgentStatus.tsx` — Status component
- `frontend/src/components/AgentStatus/types.ts` — Props interface (`AgentStatusProps`, `AgentFlightResult`)
- `frontend/src/components/AgentStatus/index.ts` — Barrel export

### US-6.6: Navbar

**Status**: `COMPLETED`

```gherkin
  Scenario: Navigation displays all links
    Given the Navbar component is mounted
    Then it shows the logo with "AeroAgent AI" title and "Swarm Control Center" subtitle
    And navigation links: Dashboard (/), History (/history), Results (/results), Settings (/settings)
    And a pulsing green "LIVE" indicator

  Scenario: Active route is visually indicated
    Given the current pathname matches a nav link
    When the Navbar renders
    Then the matching link has bold text via pathname match or prefix match
```

**Files**:
- `frontend/src/components/Navbar/Navbar.tsx` — Navigation component
- `frontend/src/components/Navbar/types.ts` — `NavbarProps`, `NavLink` types
- `frontend/src/components/Navbar/index.ts` — Barrel export

### US-6.7: Footer

**Status**: `COMPLETED`

```gherkin
  Scenario: Footer displays brand, links, and copyright
    Given the Footer component is mounted
    Then a brand column shows logo, description, and social icon placeholders
    And link columns display Product, Company, and Support links
    And a bottom bar shows copyright year and "Powered by AeroAgent" badge
    And the background is dark (#050505) with border
```

**Files**:
- `frontend/src/components/Footer/Footer.tsx` — Footer component
- `frontend/src/components/Footer/types.ts` — `FooterProps` type
- `frontend/src/components/Footer/index.ts` — Barrel export

### US-6.8: ExecutionsTable

**Status**: `COMPLETED`

```gherkin
  Scenario: Data table displays execution history
    Given the ExecutionsTable receives execution data
    Then @tanstack/react-table renders sortable, paginated rows
    And columns include Route, Date, Status, Results count, Created, Actions

  Scenario: Status badges are color-coded
    Given an execution has a status value
    Then "completed" shows a green badge
    And "running" shows a blue badge
    And "pending" shows an amber badge
    And "failed" or "cancelled" shows a red badge

  Scenario: Row click navigates to execution detail
    Given a table row is clicked
    When the execution is running or completed
    Then the user navigates to "/history/{searchId}"

  Scenario: Delete action requires confirmation
    Given the user clicks the delete action on a row
    When the AlertDialog confirmation appears
    Then confirming calls onDelete(searchId)
    And canceling dismisses the dialog

  Scenario: Empty and loading states are handled
    Given no executions exist
    Then "No search executions" message is displayed
    Given data is loading
    Then a spinner animation is shown
```

**Files**:
- `frontend/src/components/ExecutionsTable/ExecutionsTable.tsx` — Table component
- `frontend/src/components/ExecutionsTable/types.ts` — `ExecutionsTableProps` interface
- `frontend/src/components/ExecutionsTable/constants.ts` — Column definitions
- `frontend/src/components/ExecutionsTable/index.ts` — Barrel export

### US-6.9: shadcn/ui Primitives

**Status**: `COMPLETED`

```gherkin
  Scenario: 12 shadcn/ui components are installed and functional
    Given the "frontend/src/components/ui/" directory exists
    Then the following primitives are available:
      | Component    | File              | Usage                          |
      | Alert Dialog | alert-dialog.tsx  | Delete confirmation dialogs    |
      | Badge        | badge.tsx         | Status indicators, rank badges |
      | Button       | button.tsx        | Form submit, actions           |
      | Calendar     | calendar.tsx      | Date picker popover content    |
      | Card         | card.tsx          | Settings test panels           |
      | Form         | form.tsx          | SearchForm (react-hook-form)   |
      | Input        | input.tsx         | Text fields                    |
      | Label        | label.tsx         | Form labels                    |
      | Popover      | popover.tsx       | Date picker wrapper            |
      | Select       | select.tsx        | Cabin class dropdown           |
      | Switch       | switch.tsx        | Direct flights toggle          |
      | Tabs         | tabs.tsx          | Settings page tabs             |
```

**Files**:
- `frontend/src/components/ui/*.tsx` — 12 shadcn/ui primitive components

---

## Epic 7 — Library & Type System

```gherkin
Feature: Library and Type System
  As a developer
  I want type-safe utilities, providers, and schema definitions
  So that I can build features with consistent data shapes and reliable integrations
```

### US-7.1: Ollama Provider

**Status**: `COMPLETED`

```gherkin
  Scenario: AI SDK 6 provider connects to local Ollama
    Given "frontend/src/lib/localOllama.ts" defines the provider
    When createOpenAICompatible() is called
    Then the base URL is "${OLLAMA_HOST}/v1"
    And the API key is "not-required" (local)
    And OLLAMA_MODEL is exported as "qwen3:8b"
```

**Files**:
- `frontend/src/lib/localOllama.ts`

### US-7.2: Supabase Client

**Status**: `COMPLETED`

```gherkin
  Scenario: Supabase client is configured for client-side usage
    Given "frontend/src/lib/supabase.ts" defines the client
    When imported by client components
    Then a @supabase/supabase-js createClient() instance is available

  Scenario: DATABASE_URL is exported for server-side Drizzle usage
    Given server-side API routes need PostgreSQL access
    When they import DATABASE_URL
    Then it provides the connection string for Drizzle/pg
```

**Files**:
- `frontend/src/lib/supabase.ts`

### US-7.3: Embedding Generation

**Status**: `COMPLETED`

```gherkin
  Scenario: Single text embedding is generated
    Given Ollama is running with nomic-embed-text model
    When generateEmbedding("cheapest flight to LAX") is called
    Then a POST is sent to "${OLLAMA_HOST}/api/embeddings"
    And a 1536-dimension number array is returned

  Scenario: Batch embeddings are generated in parallel
    Given multiple texts need embedding
    When generateEmbeddings(["text1", "text2"]) is called
    Then Promise.all processes all texts concurrently
    And each returns a 1536-dimension number array
```

**Files**:
- `frontend/src/lib/embeddings.ts`

### US-7.4: Utility Functions

**Status**: `COMPLETED`

```gherkin
  Scenario: CSS class names are merged without conflicts
    Given cn() is called with conditional Tailwind classes
    When clsx resolves the conditionals and tailwind-merge deduplicates
    Then a single optimized class string is returned
```

**Files**:
- `frontend/src/lib/utils.ts`

### US-7.5: Zod Validation Schemas

**Status**: `COMPLETED`

```gherkin
  Scenario: Flight search parameters are validated
    Given a flightSearchParamsSchema is defined
    When input with origin, destination, departureDate, cabinClass is validated
    Then valid input passes with typed FlightSearchParams output
    And missing required fields cause ZodError

  Scenario: Search response is validated
    Given a searchResponseSchema is defined
    When API response with searchId and status is validated
    Then valid responses pass with typed SearchResponse output
```

**Files**:
- `frontend/src/lib/schemas/flightSearch.ts`

### US-7.6: TypeScript Type Definitions

**Status**: `COMPLETED`

```gherkin
  Scenario: Agent event types cover all WebSocket message types
    Given "agentEvent.ts" defines event types
    Then AgentEventType includes "status", "progress", "done", "error"
    And AgentEvent has id, timestamp, type, message, screenshotUrl?, data?
    And SearchExecutionStatus includes "idle", "connecting", "running", "completed", "error"
    And SearchExecutionState has status, events[], error?, results?

  Scenario: Flight result types support sorting and filtering
    Given "flightResult.ts" defines result types
    Then FlightResult has id, searchId, airline, departure, arrival, duration, stops, price, currency, url
    And FlightSortField includes "price", "duration", "departure"
    And SortDirection includes "asc", "desc"
    And FlightFilters has directOnly boolean

  Scenario: Execution row type matches API response shape
    Given "execution.ts" defines the ExecutionRow type
    Then it includes searchId, origin, destination, departureDate, returnDate, cabinClass
    And directOnly, createdAt, status, errorMessage, startedAt, completedAt, resultCount
```

**Files**:
- `frontend/src/lib/types/agentEvent.ts`
- `frontend/src/lib/types/flightResult.ts`
- `frontend/src/lib/types/execution.ts`

---

## Epic 8 — Dependencies & Build Configuration

```gherkin
Feature: Dependencies and Build Configuration
  As a developer
  I want all dependencies pinned and build tools configured
  So that the project builds reproducibly across environments
```

### US-8.1: Frontend Dependencies

**Status**: `COMPLETED`

```gherkin
  Scenario: Production dependencies are pinned
    Given "frontend/package.json" defines Next.js 16.1.6 and React 19.2.3
    Then the following key dependencies are installed:
      | Package                     | Version   |
      | next                        | 16.1.6    |
      | react / react-dom           | 19.2.3    |
      | ai                          | ^6.0.77   |
      | @ai-sdk/openai-compatible   | ^2.0.28   |
      | @supabase/supabase-js       | ^2.95.3   |
      | drizzle-orm                 | ^0.45.1   |
      | pg                          | ^8.18.0   |
      | zod                         | ^4.3.6    |
      | react-hook-form             | ^7.71.1   |
      | @hookform/resolvers         | ^5.2.2    |
      | @tanstack/react-table       | ^8.20.5   |
      | next-themes                 | ^0.4.6    |
      | lucide-react                | ^0.563.0  |
      | date-fns                    | ^4.1.0    |
      | react-day-picker            | ^9.13.1   |
      | jotai                       | ^2.17.1   |

  Scenario: Dev dependencies support testing and tooling
    Given the devDependencies section exists
    Then vitest ^3.2.4, @vitest/coverage-v8, and jsdom ^26.1.0 are installed
    And @testing-library/react ^16.3.2 and @testing-library/user-event ^14.6.1
    And msw ^2.12.10 for API mocking
    And tailwindcss ^4, typescript ^5, eslint ^9
```

**Files**:
- `frontend/package.json`

### US-8.2: Browser-Service Dependencies

**Status**: `COMPLETED`

```gherkin
  Scenario: Python dependencies are pinned
    Given "browser-service/requirements.txt" lists all dependencies
    Then fastapi and uvicorn are installed for the web framework
    And browser-use and playwright for browser automation
    And pydantic and pydantic-settings for validation and config
    And httpx for async HTTP client operations

  Scenario: Project metadata and linting are configured
    Given "browser-service/pyproject.toml" defines project settings
    Then Python 3.12 is the target version
    And ruff is configured for linting and formatting
```

**Files**:
- `browser-service/pyproject.toml` — Project metadata + linter config
- `browser-service/requirements.txt` — Pinned dependencies

### US-8.3: Build Configuration

**Status**: `COMPLETED`

```gherkin
  Scenario: Frontend build tooling is configured
    Given the frontend build configuration files exist
    Then "next.config.ts" configures Next.js
    And "tsconfig.json" enables strict mode with path alias "@/" → "src/"
    And "postcss.config.mjs" uses @tailwindcss/postcss
    And "eslint.config.mjs" configures ESLint
    And "components.json" configures shadcn/ui (new-york style, CSS variables, path aliases)
```

**Files**:
- `frontend/next.config.ts`
- `frontend/tsconfig.json`
- `frontend/postcss.config.mjs`
- `frontend/eslint.config.mjs`
- `frontend/components.json`

---

## Data Flow: End-to-End Search

```
User submits SearchForm
        │
        ▼
POST /api/search (Next.js)
  ├─ Cache check (skip if OpenAI key)
  ├─ INSERT agent_ctx (llm_provider, llm_model)
  ├─ INSERT agent_state (status: running)
  ├─ Fire-and-forget POST to browser-use /search
  └─ Return { searchId, status: "running" }
        │
        ▼
Redirect to /history/{searchId}
  ├─ useSearchExecution() connects WebSocket
  │     ws://browser-use:8000/ws/search/{id}
  └─ HTTP polling fallback (10s interval)
        │
        ▼
browser-use /search (Python)
  ├─ Step 0: create_stealth_browser()
  ├─ Step 1: build_kayak_url()
  ├─ Step 2: page.goto(url) + 15s wait
  ├─ Step 3: page.evaluate(EXTRACTION_JS)
  ├─ Step 4: _parse_extraction() → text_parser
  ├─ Step 5: Complete
  └─ notify_callback() → POST /api/callback/search-complete
        │
        ▼
POST /api/callback/search-complete (Next.js)
  ├─ INSERT flight_results (each result)
  ├─ UPDATE agent_state → completed
  ├─ Generate search summary embedding (Ollama)
  └─ INSERT memory (content + embedding vector)
        │
        ▼
User clicks "View Results"
        │
        ▼
/results/{searchId}
  ├─ GET /api/results/{id}
  ├─ Sort by price/duration/departure
  ├─ Filter direct-only
  └─ Render FlightCard grid
```

---

## Epic 9 — Browser-Service Testing (100% Coverage)

```gherkin
Feature: Browser-Service Testing
  As a developer
  I want 100% test coverage for all Python source files
  So that regressions are caught immediately and code quality is maintained
```

**Goal**: Achieve 100% test coverage for all 26 Python source files in `browser-service/app/` using pytest, pytest-asyncio, pytest-cov, and respx.

### US-9.1: Test Infrastructure

**Status**: `COMPLETED`

```gherkin
  Scenario: Test framework is configured
    Given "requirements-test.txt" lists pytest, pytest-asyncio, pytest-cov, respx
    And "pyproject.toml" configures asyncio_mode=auto and testpaths
    When "make test-browser-use" runs
    Then pytest discovers and runs all tests in "browser-service/tests/"

  Scenario: Shared fixtures support all test types
    Given "tests/conftest.py" defines shared fixtures
    Then an async HTTP client fixture is available for route tests
    And module-level state reset fixtures clear _active_searches and _semaphore
    And a mock browser fixture patches browser_use.Browser

  Scenario: Test directory structure is organized
    Given "tests/__init__.py", "tests/unit/__init__.py", "tests/integration/__init__.py" exist
    Then unit and integration tests are cleanly separated
```

| # | Task | Status |
|---|------|--------|
| 1 | Create `requirements-test.txt` with pytest, pytest-asyncio, pytest-cov, respx | `COMPLETED` |
| 2 | Create `tests/conftest.py` with shared fixtures (client, state reset, mock browser) | `COMPLETED` |
| 3 | Add `[tool.pytest.ini_options]` to `pyproject.toml` (asyncio_mode=auto, testpaths) | `COMPLETED` |
| 4 | Create `tests/__init__.py`, `tests/unit/__init__.py`, `tests/integration/__init__.py` | `COMPLETED` |
| 5 | Add Makefile targets: test-browser-use, test-browser-use-cov, test-browser-use-unit, test-browser-use-integration | `COMPLETED` |

### US-9.2: Unit Tests — Config, Logging, Enums, Models

**Status**: `COMPLETED`

```gherkin
  Scenario: Settings defaults and environment overrides are tested
    Given "tests/unit/test_config.py" contains 14 test cases
    When all tests pass
    Then default values and monkeypatch.setenv overrides are verified
    And extraction_mode, agent_max_steps, agent_max_failures, openai_model defaults are tested

  Scenario: Logging configuration and child loggers are tested
    Given "tests/unit/test_logger.py" contains 8 test cases
    When all tests pass
    Then configure_logging() and get_logger() work correctly

  Scenario: Enum values and membership are tested
    Given "tests/unit/test_enums.py" contains 10 test cases
    When all tests pass
    Then CabinClass and SearchStatusValue contain expected values

  Scenario: Domain, request, and response models are tested
    Given "tests/unit/test_models.py" contains 25 test cases
    When all tests pass
    Then all Pydantic models validate and serialize correctly
```

| # | Task | File | Tests |
|---|------|------|-------|
| 1 | Test Settings defaults and env overrides | `tests/unit/test_config.py` | 14 |
| 2 | Test configure_logging and get_logger | `tests/unit/test_logger.py` | 8 |
| 3 | Test CabinClass and SearchStatusValue enums | `tests/unit/test_enums.py` | 10 |
| 4 | Test domain, request, response models | `tests/unit/test_models.py` | 25 |

### US-9.3: Unit Tests — Parsers

**Status**: `COMPLETED`

```gherkin
  Scenario: JSON fixer handles malformed input
    Given "tests/unit/test_json_fixer.py" contains 22 test cases
    When all tests pass
    Then fix_malformed_json(), extract_individual_objects(), try_parse_block() are verified

  Scenario: Text parser extracts flights from raw text
    Given "tests/unit/test_text_parser.py" contains 24 test cases
    When all tests pass
    Then parse_raw_text_to_flight() and try_parse_raw_text_flights() are verified

  Scenario: Flight parser multi-strategy parsing works
    Given "tests/unit/test_flight_parser.py" contains 19 test cases
    When all tests pass
    Then normalize_result_keys(), try_parse_flight_json(), parse_flight_results() are verified
```

| # | Task | File | Tests |
|---|------|------|-------|
| 1 | Test fix_malformed_json, extract_individual_objects, try_parse_block | `tests/unit/test_json_fixer.py` | 22 |
| 2 | Test parse_raw_text_to_flight, try_parse_raw_text_flights, helpers | `tests/unit/test_text_parser.py` | 24 |
| 3 | Test normalize_result_keys, try_parse_flight_json, parse_flight_results | `tests/unit/test_flight_parser.py` | 19 |

### US-9.4: Unit Tests — Prompts, Constants

**Status**: `COMPLETED`

```gherkin
  Scenario: Kayak URL builder and prompt templates are tested
    Given "tests/unit/test_kayak_prompts.py" contains 19 test cases
    When all tests pass
    Then build_kayak_url() and build_flight_search_prompt() produce correct output

  Scenario: Extraction prompt template is tested
    Given "tests/unit/test_extraction_prompt.py" contains 10 test cases
    When all tests pass
    Then build_extraction_prompt() returns expected prompt text

  Scenario: Stealth constants are tested
    Given "tests/unit/test_stealth.py" contains 14 test cases
    When all tests pass
    Then USER_AGENTS has 5 entries and STEALTH_JS contains all required overrides

  Scenario: DOM extraction JavaScript is tested
    Given "tests/unit/test_selectors.py" contains 12 test cases
    When all tests pass
    Then EXTRACTION_JS contains resultInner queries and fallback logic
```

| # | Task | File | Tests |
|---|------|------|-------|
| 1 | Test build_kayak_url and build_flight_search_prompt | `tests/unit/test_kayak_prompts.py` | 19 |
| 2 | Test build_extraction_prompt | `tests/unit/test_extraction_prompt.py` | 10 |
| 3 | Test USER_AGENTS and STEALTH_JS | `tests/unit/test_stealth.py` | 14 |
| 4 | Test EXTRACTION_JS | `tests/unit/test_selectors.py` | 12 |

### US-9.5: Integration Tests — Routes and Services

**Status**: `COMPLETED`

```gherkin
  Scenario: Health endpoint returns expected response
    Given "tests/integration/test_health_route.py" contains 3 test cases
    When GET /health is tested
    Then the response is {"status": "ok"}

  Scenario: Search and status routes handle full lifecycle
    Given "tests/integration/test_search_route.py" contains 9 test cases
    When POST /search and GET /status/{id} are tested
    Then search initiation and status polling work correctly

  Scenario: WebSocket streams events correctly
    Given "tests/integration/test_websocket_route.py" contains 5 test cases
    When WS /ws/search/{id} is tested via TestClient
    Then progress events are received and terminal states close the connection

  Scenario: Callback notifications are sent correctly
    Given "tests/integration/test_callback_service.py" contains 6 test cases
    When notify_callback is tested with respx HTTP mocking
    Then success and failure callbacks are sent to the correct URL

  Scenario: Browser service lifecycle is tested
    Given "tests/integration/test_browser_service.py" contains 13 test cases
    When browser creation, screenshot, and cleanup are tested
    Then stealth browser and agent browser both configure correctly and clean up on close

  Scenario: Search orchestration is tested end-to-end
    Given "tests/integration/test_search_service.py" contains 28 test cases
    When init, state management, helpers, parsing, and dual-mode dispatch are tested
    Then the full search pipeline works from request to callback in both direct and agent modes
```

| # | Task | File | Tests |
|---|------|------|-------|
| 1 | Test GET /health endpoint | `tests/integration/test_health_route.py` | 3 |
| 2 | Test POST /search and GET /status/{id} | `tests/integration/test_search_route.py` | 9 |
| 3 | Test WS /ws/search/{search_id} | `tests/integration/test_websocket_route.py` | 5 |
| 4 | Test notify_callback with respx mocking | `tests/integration/test_callback_service.py` | 6 |
| 5 | Test browser config, screenshot, close, create (both modes) | `tests/integration/test_browser_service.py` | 13 |
| 6 | Test search orchestration (init, state, helpers, parse, dual-mode) | `tests/integration/test_search_service.py` | 28 |

**Total**: ~177 tests across 17 test files targeting 100% coverage of 26 source files.

---

## File Inventory

### Browser-Service (`browser-service/app/`) — 16 Python files

| File | Purpose |
|------|---------|
| `__init__.py` | Package init |
| `main.py` | FastAPI app factory (lifespan, CORS, routers) |
| `config.py` | Pydantic Settings (ollama, openai, callback, concurrency) |
| `logger.py` | Structured logging (configure + get_logger) |
| `models/__init__.py` | Models package init |
| `models/enums.py` | CabinClass, SearchStatusValue enums |
| `models/domain.py` | FlightResult, ProgressEvent, SearchStatus |
| `models/requests.py` | FlightSearchRequest |
| `models/responses.py` | HealthResponse, SearchResponse, StatusResponse, etc. |
| `routes/__init__.py` | Routes package init |
| `routes/health.py` | GET /health |
| `routes/search.py` | POST /search, GET /status/{id} |
| `routes/websocket.py` | WS /ws/search/{id} |
| `services/__init__.py` | Services package init |
| `services/browser.py` | Dual browser factories (stealth CDP + agent mode), screenshots, cleanup |
| `services/callback.py` | HTTP callback to Next.js |
| `services/search.py` | Core search pipeline: dual-mode dispatcher (_run_search_direct / _run_search_agent) |
| `parsers/__init__.py` | Parsers package init |
| `parsers/text_parser.py` | Direct mode: regex text → FlightResult parser |
| `parsers/flight_parser.py` | Agent mode: 7-strategy multi-parser |
| `parsers/json_fixer.py` | JSON repair utilities |
| `constants/__init__.py` | Constants package init |
| `constants/stealth.py` | USER_AGENTS, STEALTH_JS |
| `constants/selectors.py` | EXTRACTION_JS (DOM scraper) |
| `prompts/__init__.py` | Prompts package init |
| `prompts/kayak.py` | build_kayak_url() (both modes), build_flight_search_prompt() (agent mode) |
| `prompts/extraction.py` | build_extraction_prompt() (agent mode) |

### Frontend (`frontend/src/`) — 43+ TypeScript/TSX files

#### Pages (App Router)
| File | Route | Description |
|------|-------|-------------|
| `app/layout.tsx` | — | Root layout (ThemeProvider, Navbar, Footer) |
| `app/page.tsx` | `/` | Home (SearchForm, hero, features) |
| `app/globals.css` | — | Tailwind v4 config + custom styles |
| `app/credits/page.tsx` | `/credits` | Credits (team, features showcase) |
| `app/history/page.tsx` | `/history` | Execution list (ExecutionsTable) |
| `app/history/[id]/page.tsx` | `/history/[id]` | Execution timeline + status |
| `app/results/page.tsx` | `/results` | Redirect → `/history` (legacy route) |
| `app/results/[id]/page.tsx` | `/results/[id]` | Results display (sort/filter) |
| `app/settings/page.tsx` | `/settings` | Settings wrapper |

#### API Routes
| File | Endpoint |
|------|----------|
| `app/api/health/route.ts` | `GET /api/health` |
| `app/api/search/route.ts` | `POST /api/search` |
| `app/api/results/[id]/route.ts` | `GET /api/results/[id]` |
| `app/api/status/[id]/route.ts` | `GET /api/status/[id]` |
| `app/api/callback/search-complete/route.ts` | `POST /api/callback/search-complete` |
| `app/api/ai/ollama-test/route.ts` | `GET /api/ai/ollama-test` |
| `app/api/browser-use/health/route.ts` | `GET /api/browser-use/health` |
| `app/api/db/test-connection/route.ts` | `GET /api/db/test-connection` |
| `app/api/db/test-pgvector/route.ts` | `GET /api/db/test-pgvector` |
| `app/api/memory/route.ts` | `POST /api/memory` |
| `app/api/memory/search/route.ts` | `GET /api/memory/search` |
| `app/api/system/status/route.ts` | `GET /api/system/status` |
| `app/api/verify/[id]/route.ts` | `POST /api/verify/[id]` |
| `app/api/search/[id]/cancel/route.ts` | `POST /api/search/[id]/cancel` |
| `app/api/executions/route.ts` | `GET /api/executions` |
| `app/api/executions/[id]/route.ts` | `DELETE /api/executions/[id]` |

#### Components
| Directory | Files | Purpose |
|-----------|-------|---------|
| `components/SearchForm/` | SearchForm.tsx, types.ts, hooks/useFlightSearch.ts, index.ts | Flight search form |
| `components/FlightCard/` | FlightCard.tsx, types.ts, index.ts | Result card display |
| `components/ExecutionTimeline/` | ExecutionTimeline.tsx, types.ts, hooks/useSearchExecution.ts, index.ts | Real-time timeline |
| `components/ExecutionsTable/` | ExecutionsTable.tsx, types.ts, constants.ts, index.ts | Execution history table |
| `components/AgentStatus/` | AgentStatus.tsx, types.ts, index.ts | Status badge |
| `components/Navbar/` | Navbar.tsx, types.ts, index.ts | Top navigation |
| `components/Footer/` | Footer.tsx, types.ts, index.ts | Page footer |
| `components/settings/` | index.tsx, 4 test components (each with hooks/) | Settings tabs |
| `components/ui/` | 12 shadcn/ui primitives | UI building blocks |
| `components/` | theme-provider.tsx, theme-toggle.tsx | Theme support |

#### Library
| File | Purpose |
|------|---------|
| `lib/localOllama.ts` | AI SDK Ollama provider |
| `lib/supabase.ts` | Supabase client + DATABASE_URL |
| `lib/embeddings.ts` | Ollama embedding generation |
| `lib/utils.ts` | cn() class merge utility |
| `lib/schemas/flightSearch.ts` | Zod validation schemas |
| `lib/types/agentEvent.ts` | Agent event type definitions |
| `lib/types/flightResult.ts` | Flight result type definitions |
| `lib/types/execution.ts` | Execution row type definitions |

#### Database
| File | Purpose |
|------|---------|
| `db/schema.ts` | Drizzle ORM schema (4 tables + custom vector type) |

### Supabase
| File | Purpose |
|------|---------|
| `supabase/init.sql` | DDL: pgvector, 4 tables, indexes, grants |

### Config Files
| File | Purpose |
|------|---------|
| `docker-compose.yml` | Production compose |
| `docker-compose.dev.yml` | Dev compose override |
| `Makefile` | Build/dev convenience targets |
| `.env.example` | Environment template |
| `CLAUDE.md` | Project instructions for AI assistants |
| `README.md` | Project documentation with architecture, setup, and usage |
| `README-PLAN.md` | Architecture reference |
| `README-SKILLS.md` | Skill authoring conventions |
| `SPECS.md` | Engineering specification (this file) |

---

## Epic 10 — Terminate Search

```gherkin
Feature: Terminate Search
  As a user
  I want to cancel an in-progress flight search
  So that I can stop long-running searches and start new ones
```

**Goal**: Allow users to terminate an in-progress flight search via a UI button, using `asyncio.Task.cancel()` on the backend and a REST cancel endpoint proxied through Next.js.

### US-10.1: Backend Cancel Infrastructure

**Status**: `COMPLETED`

```gherkin
  Scenario: CANCELLED status is a valid search state
    Given SearchStatusValue enum is defined
    Then "cancelled" is a valid enum member

  Scenario: Async task handle is stored for cancellation
    Given a search starts via _run_search()
    When asyncio.create_task() creates the task
    Then the Task handle is stored in _active_tasks dict with auto-cleanup callback

  Scenario: CancelledError is handled gracefully
    Given a running search task receives cancellation
    When asyncio.CancelledError is raised in _run_search()
    Then the browser is cleaned up safely
    And the callback is notified with status "cancelled"

  Scenario: Cancel endpoint terminates a running search
    Given a search with ID "abc-123" is running
    When a client sends "POST /search/abc-123/cancel"
    Then the asyncio.Task is cancelled
    And status is set to CANCELLED
    And the response confirms cancellation

  Scenario: Cancel returns 404 for unknown search
    Given no search with ID "unknown" exists
    When "POST /search/unknown/cancel" is sent
    Then the response status is 404

  Scenario: Cancel returns 409 for non-running search
    Given a search with ID "abc-123" is already completed
    When "POST /search/abc-123/cancel" is sent
    Then the response status is 409

  Scenario: WebSocket handles CANCELLED as terminal state
    Given a WebSocket is connected to a search
    When the search status changes to CANCELLED
    Then a cancelled message is sent via _send_cancelled()
    And the WebSocket connection closes
```

| # | Task | Status |
|---|------|--------|
| 1 | Add `CANCELLED = "cancelled"` to `SearchStatusValue` enum | `COMPLETED` |
| 2 | Store `asyncio.Task` handle in `_active_tasks` dict with auto-cleanup callback | `COMPLETED` |
| 3 | Handle `asyncio.CancelledError` in `_run_search()` — graceful browser cleanup + callback notification | `COMPLETED` |
| 4 | Add `_cancel_search()` private helper (marks status CANCELLED) + `cancel_search()` public function | `COMPLETED` |
| 5 | Add `POST /search/{search_id}/cancel` REST endpoint (404 if not found, 409 if not running) | `COMPLETED` |
| 6 | Update WebSocket to handle `CANCELLED` as terminal state (initial catch-up + polling loop) | `COMPLETED` |
| 7 | Add `_send_cancelled()` WebSocket helper | `COMPLETED` |

**Files modified**:
- `browser-service/app/models/enums.py` — Added `CANCELLED` enum value
- `browser-service/app/services/search.py` — Task storage, CancelledError handler, cancel functions
- `browser-service/app/routes/search.py` — Cancel endpoint
- `browser-service/app/routes/websocket.py` — Cancelled terminal state handling

### US-10.2: Frontend Cancel UI

**Status**: `COMPLETED`

```gherkin
  Scenario: Cancel proxy route forwards to browser-use
    Given a running search with ID "abc-123"
    When a client sends "POST /api/search/abc-123/cancel"
    Then the request is proxied to "POST {BROWSER_USE_API_URL}/search/abc-123/cancel"

  Scenario: Cancelled status is supported in TypeScript types
    Given AgentEventType and SearchExecutionStatus include "cancelled"
    Then the type system accepts cancelled as a valid state

  Scenario: WebSocket hook handles cancellation events
    Given useSearchExecution is connected to a search
    When a "cancelled" message arrives via WebSocket or HTTP polling
    Then the execution state transitions to "cancelled"

  Scenario: AgentStatus displays cancelled state
    Given the agent status is "cancelled"
    Then an amber XCircle icon is displayed
    And an amber badge shows "Cancelled"
    And a descriptive message explains the cancellation

  Scenario: ExecutionTimeline renders cancelled state
    Given the execution is cancelled
    Then a cancelled event icon and badge are displayed
    And the timeline marks the search as finished

  Scenario: Terminate button is shown during active search
    Given a search is in "running" or "connecting" state
    When the history page renders
    Then a red outline Terminate button with Square icon is visible
    When the user clicks Terminate
    Then "POST /api/search/{id}/cancel" is called
```

| # | Task | Status |
|---|------|--------|
| 1 | Create Next.js proxy route `POST /api/search/[id]/cancel` → browser-use | `COMPLETED` |
| 2 | Add `"cancelled"` to `AgentEventType` and `SearchExecutionStatus` TypeScript types | `COMPLETED` |
| 3 | Handle `"cancelled"` WebSocket message + HTTP polling status in `useSearchExecution` hook | `COMPLETED` |
| 4 | Add `"cancelled"` rendering to `AgentStatus` component (amber XCircle icon + badge + message) | `COMPLETED` |
| 5 | Add `"cancelled"` rendering to `ExecutionTimeline` (icon + badge + searchFinished check) | `COMPLETED` |
| 6 | Add Terminate button to history page (visible during running/connecting, red outline, Square icon) | `COMPLETED` |

**Files created**:
- `frontend/src/app/api/search/[id]/cancel/route.ts`

**Files modified**:
- `frontend/src/lib/types/agentEvent.ts`
- `frontend/src/components/ExecutionTimeline/hooks/useSearchExecution.ts`
- `frontend/src/components/AgentStatus/AgentStatus.tsx`
- `frontend/src/components/ExecutionTimeline/ExecutionTimeline.tsx`
- `frontend/src/app/history/[id]/page.tsx`

---

## Epic 11 — Frontend Testing (100% Coverage)

```gherkin
Feature: Frontend Testing
  As a developer
  I want comprehensive Vitest test coverage for all frontend code
  So that UI components, API routes, hooks, and utilities are verified against regressions
```

**Goal**: Achieve comprehensive test coverage for the entire Next.js frontend using Vitest, React Testing Library, and MSW (Mock Service Worker) for API mocking.

### US-11.1: Test Infrastructure

**Status**: `COMPLETED`

```gherkin
  Scenario: Vitest is configured with React and jsdom
    Given "vitest.config.ts" configures the test runner
    Then @vitejs/plugin-react and jsdom environment are enabled
    And path aliases map "@/" to "src/"
    And coverage uses @vitest/coverage-v8

  Scenario: Global test setup provides matchers and mocks
    Given "src/__tests__/setup.ts" is loaded before tests
    Then @testing-library/jest-dom matchers are available
    And MSW server is configured for API mocking

  Scenario: PostgreSQL mock utilities are available
    Given "src/__tests__/helpers/mockPg.ts" is defined
    Then API route tests can mock pg.Pool and pg.Client

  Scenario: Shared test fixtures cover all data shapes
    Given "src/__tests__/fixtures/" contains test data files
    Then searchParams, flightResults, agentEvents, and apiResponses fixtures exist
    And all fixtures match the TypeScript type definitions
```

| # | Task | Status |
|---|------|--------|
| 1 | Configure `vitest.config.ts` with jsdom, React plugin, path aliases, coverage settings | `COMPLETED` |
| 2 | Create `src/__tests__/setup.ts` with global test setup (jest-dom matchers, MSW server) | `COMPLETED` |
| 3 | Create `src/__tests__/helpers/mockPg.ts` for PostgreSQL mock utilities | `COMPLETED` |
| 4 | Create `src/__tests__/fixtures/` with shared test data (searchParams, flightResults, agentEvents, apiResponses) | `COMPLETED` |
| 5 | Add `test`, `test:watch`, `test:coverage` scripts to `package.json` | `COMPLETED` |
| 6 | Add Makefile target: `test-frontend` | `COMPLETED` |

**Files**:
- `frontend/vitest.config.ts` — Vitest configuration
- `frontend/src/__tests__/setup.ts` — Global test setup
- `frontend/src/__tests__/helpers/mockPg.ts` — PostgreSQL mock utilities
- `frontend/src/__tests__/fixtures/searchParams.ts` — Search parameter test data
- `frontend/src/__tests__/fixtures/flightResults.ts` — Flight result test data
- `frontend/src/__tests__/fixtures/agentEvents.ts` — Agent event test data
- `frontend/src/__tests__/fixtures/apiResponses.ts` — API response test data

### US-11.2: Page Tests

**Status**: `COMPLETED`

```gherkin
  Scenario: All 7 pages have test coverage
    Given test files exist for each page in the App Router
    When all page tests run
    Then root layout renders ThemeProvider, Navbar, and Footer
    And home page renders SearchForm
    And credits page renders team roster and features
    And history page renders ExecutionsTable
    And execution page renders timeline and agent status
    And results redirect page triggers redirect to /history
    And results display page renders FlightCards with sort/filter
    And settings page renders 4 service test tabs
```

| # | Test File | Target |
|---|-----------|--------|
| 1 | `app/layout.test.tsx` | Root layout (ThemeProvider, Navbar, Footer) |
| 2 | `app/page.test.tsx` | Home page (SearchForm rendering) |
| 3 | `app/credits/page.test.tsx` | Credits page (team roster, features) |
| 4 | `app/history/page.test.tsx` | History list page (ExecutionsTable) |
| 5 | `app/history/[id]/page.test.tsx` | Execution timeline page |
| 6 | `app/results/page.test.tsx` | Results redirect page |
| 7 | `app/results/[id]/page.test.tsx` | Results display page (sort/filter) |
| 8 | `app/settings/page.test.tsx` | Settings page (tabs) |

### US-11.3: API Route Tests

**Status**: `COMPLETED`

```gherkin
  Scenario: All 16 API routes have test coverage
    Given test files exist for each API route handler
    When all API route tests run
    Then each route handler is tested with valid inputs, error cases, and edge conditions
    And PostgreSQL is mocked via mockPg utilities
    And external service calls are mocked via MSW or fetch mocking
```

| # | Test File | Target Route |
|---|-----------|-------------|
| 1 | `app/api/health/route.test.ts` | `GET /api/health` |
| 2 | `app/api/search/route.test.ts` | `POST /api/search` |
| 3 | `app/api/results/[id]/route.test.ts` | `GET /api/results/[id]` |
| 4 | `app/api/status/[id]/route.test.ts` | `GET /api/status/[id]` |
| 5 | `app/api/callback/search-complete/route.test.ts` | `POST /api/callback/search-complete` |
| 6 | `app/api/ai/ollama-test/route.test.ts` | `GET /api/ai/ollama-test` |
| 7 | `app/api/browser-use/health/route.test.ts` | `GET /api/browser-use/health` |
| 8 | `app/api/db/test-connection/route.test.ts` | `GET /api/db/test-connection` |
| 9 | `app/api/db/test-pgvector/route.test.ts` | `GET /api/db/test-pgvector` |
| 10 | `app/api/memory/route.test.ts` | `POST /api/memory` |
| 11 | `app/api/memory/search/route.test.ts` | `GET /api/memory/search` |
| 12 | `app/api/system/status/route.test.ts` | `GET /api/system/status` |
| 13 | `app/api/verify/[id]/route.test.ts` | `POST /api/verify/[id]` |
| 14 | `app/api/search/[id]/cancel/route.test.ts` | `POST /api/search/[id]/cancel` |
| 15 | `app/api/executions/route.test.ts` | `GET /api/executions` |
| 16 | `app/api/executions/[id]/route.test.ts` | `DELETE /api/executions/[id]` |

### US-11.4: Component Tests

**Status**: `COMPLETED`

```gherkin
  Scenario: All custom components have test coverage
    Given test files exist for each custom component
    When all component tests run
    Then SearchForm validates input and submits correctly
    And useFlightSearch hook handles API calls and redirects
    And FlightCard displays flight data with rank badges and verification status
    And ExecutionTimeline renders events with icons and expandable details
    And useSearchExecution hook manages WebSocket and polling fallback
    And ExecutionsTable renders sortable, paginated data with delete confirmation
    And AgentStatus renders all 5 states with correct icons and colors
    And Navbar renders navigation links with active state highlighting
    And Footer renders brand, links, and copyright sections
    And ThemeProvider wraps children with next-themes
    And ThemeToggle switches between light and dark modes
    And Settings renders 4 tabbed test panels
```

| # | Test File | Target Component |
|---|-----------|-----------------|
| 1 | `components/SearchForm/SearchForm.test.tsx` | SearchForm |
| 2 | `components/SearchForm/hooks/useFlightSearch.test.ts` | useFlightSearch hook |
| 3 | `components/FlightCard/FlightCard.test.tsx` | FlightCard |
| 4 | `components/ExecutionTimeline/ExecutionTimeline.test.tsx` | ExecutionTimeline |
| 5 | `components/ExecutionTimeline/hooks/useSearchExecution.test.ts` | useSearchExecution hook |
| 6 | `components/ExecutionsTable/ExecutionsTable.test.tsx` | ExecutionsTable |
| 7 | `components/AgentStatus/AgentStatus.test.tsx` | AgentStatus |
| 8 | `components/Navbar/Navbar.test.tsx` | Navbar |
| 9 | `components/Footer/Footer.test.tsx` | Footer |
| 10 | `components/theme-provider.test.tsx` | ThemeProvider |
| 11 | `components/theme-toggle.test.tsx` | ThemeToggle |
| 12 | `components/settings/settings.test.tsx` | Settings tabs |

### US-11.5: Settings Sub-Component Tests

**Status**: `COMPLETED`

```gherkin
  Scenario: All 4 settings sub-components and hooks are tested
    Given each settings panel has a component test and a hook test
    When all settings tests run
    Then OllamaConnectionTest renders test button and displays streaming response
    And useOllamaConnectionTest manages fetch state and error handling
    And DatabaseConnectionTest renders connection and pgvector test results
    And useDatabaseConnectionTest handles dual-endpoint testing
    And BrowserUseHealthTest renders health check result
    And useBrowserUseHealthTest manages health check fetch
    And SystemStatus renders aggregate health for all services
    And useSystemStatus manages multi-service health aggregation
```

| # | Test File | Target |
|---|-----------|--------|
| 1 | `components/settings/components/OllamaConnectionTest/OllamaConnectionTest.test.tsx` | Ollama test UI |
| 2 | `components/settings/components/OllamaConnectionTest/hooks/useOllamaConnectionTest.test.ts` | Ollama test hook |
| 3 | `components/settings/components/DatabaseConnectionTest/DatabaseConnectionTest.test.tsx` | Database test UI |
| 4 | `components/settings/components/DatabaseConnectionTest/hooks/useDatabaseConnectionTest.test.ts` | Database test hook |
| 5 | `components/settings/components/BrowserUseHealthTest/BrowserUseHealthTest.test.tsx` | Browser-use test UI |
| 6 | `components/settings/components/BrowserUseHealthTest/hooks/useBrowserUseHealthTest.test.ts` | Browser-use test hook |
| 7 | `components/settings/components/SystemStatus/SystemStatus.test.tsx` | System status UI |
| 8 | `components/settings/components/SystemStatus/hooks/useSystemStatus.test.ts` | System status hook |

### US-11.6: shadcn/ui Primitive Tests

**Status**: `COMPLETED`

```gherkin
  Scenario: All 12 shadcn/ui primitives have test coverage
    Given test files exist for each shadcn/ui component
    When all primitive tests run
    Then each component renders correctly with default props
    And variant classes are applied correctly
    And event handlers fire as expected
    And accessibility attributes are present
```

| # | Test File | Target |
|---|-----------|--------|
| 1 | `components/ui/alert-dialog.test.tsx` | AlertDialog |
| 2 | `components/ui/badge.test.tsx` | Badge |
| 3 | `components/ui/button.test.tsx` | Button |
| 4 | `components/ui/calendar.test.tsx` | Calendar |
| 5 | `components/ui/card.test.tsx` | Card |
| 6 | `components/ui/form.test.tsx` | Form |
| 7 | `components/ui/input.test.tsx` | Input |
| 8 | `components/ui/label.test.tsx` | Label |
| 9 | `components/ui/popover.test.tsx` | Popover |
| 10 | `components/ui/select.test.tsx` | Select |
| 11 | `components/ui/switch.test.tsx` | Switch |
| 12 | `components/ui/tabs.test.tsx` | Tabs |

### US-11.7: Library Tests

**Status**: `COMPLETED`

```gherkin
  Scenario: All library modules have test coverage
    Given test files exist for each library module
    When all library tests run
    Then cn() merges Tailwind classes without conflicts
    And localOllama creates an OpenAI-compatible provider for Ollama
    And supabase client initializes and DATABASE_URL is exported
    And generateEmbedding() calls Ollama and returns 1536-dim vectors
    And flightSearchParamsSchema validates correct inputs and rejects invalid
    And Drizzle ORM schema defines all 4 tables with correct types
```

| # | Test File | Target |
|---|-----------|--------|
| 1 | `lib/utils.test.ts` | cn() utility |
| 2 | `lib/localOllama.test.ts` | Ollama AI SDK provider |
| 3 | `lib/supabase.test.ts` | Supabase client + DATABASE_URL |
| 4 | `lib/embeddings.test.ts` | Embedding generation |
| 5 | `lib/schemas/flightSearch.test.ts` | Zod validation schemas |
| 6 | `db/schema.test.ts` | Drizzle ORM schema definitions |

**Total**: 62 test files across pages, API routes, components, and library modules.

---

## Notes

### Installed but Unused Dependencies
- **Jotai** (`^2.17.1`): Installed in `package.json` but no atoms are defined or used anywhere in the codebase. State management uses local `useState`/`useRef` hooks exclusively.

### Dual-Mode Extraction Architecture
The browser-service supports two extraction modes controlled by `EXTRACTION_MODE`:
- **direct** (default): `page.goto()` → `page.evaluate(EXTRACTION_JS)` → `text_parser.py` — no LLM required
- **agent**: browser-use `Agent` + LLM → `flight_parser.py` (7-strategy) — requires Ollama or OpenAI

Previously listed as "dead code", the following modules are now **active in agent mode**:
- `app/parsers/flight_parser.py` — 7-strategy multi-parser
- `app/prompts/kayak.py::build_flight_search_prompt()` — Agent prompt template
- `app/prompts/extraction.py::build_extraction_prompt()` — LLM extraction prompt
- `app/models/domain.py::FlightResultsOutput` — Agent response model

See [AI-Browser-Use-Agent.md](AI-Browser-Use-Agent.md) for the full implementation plan and status.
