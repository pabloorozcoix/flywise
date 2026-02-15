# AeroAgent AI — Engineering Specification

> **Single source of truth** documenting the complete AeroAgent AI flight search application as implemented.
> Reference architecture lives in [README-PLAN.md](README-PLAN.md). Claude Code skill conventions live in [README-SKILLS.md](README-SKILLS.md).

---

## Project Status

All **8 epics** are **COMPLETED**. The application is fully functional as a 100% local, Docker-based flight search system.

---

## Architecture Summary

AeroAgent AI is a **four-service Docker Compose application** for automated flight search:

| Service | Tech | Port | Purpose |
|---------|------|------|---------|
| **Next.js** | TypeScript, App Router, Tailwind v4, shadcn/ui | 3000 | Frontend + 13 API routes |
| **Ollama** | qwen3:8b model | 11434 | Local LLM for AI SDK tests + embeddings |
| **browser-use** | Python 3.12, FastAPI, Playwright | 8000 | Browser automation flight scraping |
| **PostgreSQL** | Supabase Postgres 17 + pgvector | 5432 | Persistent storage + vector search |

### Key Architecture Decisions

- **Direct browser automation**: The browser-service uses `page.goto()` + `page.evaluate()` to scrape Kayak — it does **not** use the browser-use `Agent` class at runtime nor invoke any LLM during search execution.
- **Target site**: Kayak (via `build_kayak_url()` URL construction).
- **LLM tracking without LLM usage**: The frontend stores `llm_provider` and `llm_model` in `agent_ctx` for display purposes, but the browser-service search pipeline does not call any LLM.
- **Dual-mode progress streaming**: WebSocket primary + HTTP polling fallback for real-time execution updates.
- **Stealth browsing**: CDP-injected JavaScript for navigator overrides, user-agent rotation, random delays.

---

## Epic 1 — Local Docker Infrastructure

### US-1.1: Docker Compose Orchestration

**Status**: `COMPLETED`

Four services orchestrated via `docker-compose.yml` on the `aeroagent` bridge network:

- **nextjs** — Multi-stage Dockerfile (`frontend/Dockerfile`), port 3000, depends on ollama + supabase-db (healthy)
- **ollama** — `ollama/ollama:latest`, port 11434, GPU passthrough optional (NVIDIA only), health check `GET /api/tags`
- **browser-use** — Custom Dockerfile (`browser-service/Dockerfile`), port 8000, `shm_size: 2gb` for Chromium stability, depends on ollama (healthy)
- **supabase-db** — `supabase/postgres:17.6.1.081`, port 5432, volume `supabase_data`, init script `supabase/init.sql`, health check `pg_isready`

**Files**:
- `docker-compose.yml` — Production compose (4 services, named volumes, health checks, startup ordering)
- `docker-compose.dev.yml` — Development override (volume mounts for hot reload, `next dev` + `uvicorn --reload`)
- `frontend/Dockerfile` — Multi-stage: deps → build → runner (node:22-alpine)
- `frontend/Dockerfile.dev` — Single-stage dev (next dev)
- `browser-service/Dockerfile` — python:3.12-slim + system Chromium + uv package manager
- `browser-service/Dockerfile.dev` — Dev build (uvicorn --reload)
- `Makefile` — 18 convenience targets (up, down, build, dev, dev-down, dev-build, dev-logs, etc.)

### US-1.2: Environment Configuration

**Status**: `COMPLETED`

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

### US-2.1: PostgreSQL + pgvector Schema

**Status**: `COMPLETED`

Four tables defined in `supabase/init.sql`:

#### `agent_ctx` — Search Parameters
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `origin` | VARCHAR(10) | NOT NULL, airport code |
| `destination` | VARCHAR(10) | NOT NULL, airport code |
| `departure_date` | DATE | NOT NULL |
| `return_date` | DATE | Nullable (one-way) |
| `cabin_class` | VARCHAR(20) | Default `'economy'` |
| `direct_only` | BOOLEAN | Default `FALSE` |
| `llm_provider` | VARCHAR(20) | Default `'ollama'` |
| `llm_model` | VARCHAR(50) | Default `'qwen3:8b'` |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |
| `updated_at` | TIMESTAMPTZ | Default `NOW()` |

#### `agent_state` — Execution Status
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `agent_ctx_id` | UUID FK | References `agent_ctx(id)` ON DELETE CASCADE |
| `status` | VARCHAR(20) | NOT NULL, CHECK IN (`'pending'`, `'running'`, `'completed'`, `'failed'`) |
| `error_message` | TEXT | Nullable |
| `started_at` | TIMESTAMPTZ | Nullable |
| `completed_at` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |
| `updated_at` | TIMESTAMPTZ | Default `NOW()` |

#### `memory` — Agent Memory with Vector Embeddings
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `agent_ctx_id` | UUID FK | References `agent_ctx(id)` ON DELETE CASCADE |
| `content` | TEXT | NOT NULL, search summary text |
| `embedding` | vector(1536) | Nullable, Ollama-generated |
| `step_number` | INTEGER | Nullable |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

#### `flight_results` — Extracted Flights
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `agent_ctx_id` | UUID FK | References `agent_ctx(id)` ON DELETE CASCADE |
| `airline` | VARCHAR(100) | Nullable |
| `departure_time` | TIMESTAMPTZ | Nullable |
| `arrival_time` | TIMESTAMPTZ | Nullable |
| `duration` | VARCHAR(20) | Nullable |
| `stops` | INTEGER | Default `0` |
| `price` | DECIMAL(10,2) | Nullable |
| `currency` | VARCHAR(3) | Default `'USD'` |
| `flight_url` | TEXT | Nullable |
| `raw_data` | JSONB | Full extracted data fallback |
| `verified` | BOOLEAN | Default `FALSE` |
| `verified_at` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

**Indexes**:
- `idx_agent_state_ctx_id` — B-tree on `agent_state(agent_ctx_id)`
- `idx_agent_state_status` — B-tree on `agent_state(status)`
- `idx_memory_ctx_id` — B-tree on `memory(agent_ctx_id)`
- `idx_flight_results_ctx_id` — B-tree on `flight_results(agent_ctx_id)`
- `idx_memory_embedding` — IVFFlat on `memory(embedding)` with `vector_cosine_ops`, 100 lists

**Permissions**: All table/sequence privileges granted to `postgres` role with default privilege forwarding from `supabase_admin`.

**Files**:
- `supabase/init.sql` — Complete DDL

### US-2.2: Drizzle ORM Schema

**Status**: `COMPLETED`

TypeScript Drizzle schema mirrors the SQL DDL exactly.

**Features**:
- Custom `vector1536` type for pgvector `vector(1536)` columns with `toDriver`/`fromDriver` serialization
- All four tables: `agentCtx`, `agentState`, `memory`, `flightResults`
- Foreign key cascades matching SQL
- Default values matching SQL
- Timestamp columns with `withTimezone: true`

**Files**:
- `frontend/src/db/schema.ts` — Drizzle ORM table definitions

---

## Epic 3 — Browser-Use Service (Python FastAPI)

### US-3.1: FastAPI Application Factory

**Status**: `COMPLETED`

App factory pattern in `app/main.py` with:
- **Lifespan handler**: Startup/shutdown logging
- **CORS middleware**: Allow all origins, methods, headers
- **Router registration**: Health, search, and WebSocket routers with `/` prefix
- **Root endpoint**: `GET /` returns `{"service": "browser-use", "status": "ready"}`

**Files**:
- `app/main.py` — FastAPI app factory
- `app/__init__.py` — Package init

### US-3.2: Configuration

**Status**: `COMPLETED`

Pydantic-settings `BaseSettings` class with `@lru_cache` singleton:

| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| `ollama_host` | str | `http://ollama:11434` | Ollama API URL |
| `ollama_model` | str | `qwen3:8b` | Default Ollama model |
| `openai_model` | str | `gpt-4.1-mini` | OpenAI model when API key provided |
| `openai_api_key` | str | `""` | Optional OpenAI API key |
| `nextjs_callback_url` | str | `http://nextjs:3000/api/callback/search-complete` | Callback URL |
| `max_concurrent_searches` | int | `3` | Semaphore limit |

**Files**:
- `app/config.py` — Settings class

### US-3.3: Structured Logging

**Status**: `COMPLETED`

- `configure_logging()` sets up root logger with structured format
- `get_logger(name)` returns namespaced child loggers
- Log format: `%(asctime)s | %(levelname)-8s | %(name)s | %(message)s`

**Files**:
- `app/logger.py` — Logging configuration

### US-3.4: Pydantic Domain Models

**Status**: `COMPLETED`

**Models layer** (`app/models/`):

| File | Models | Notes |
|------|--------|-------|
| `enums.py` | `CabinClass`, `SearchStatusValue` | String enums |
| `domain.py` | `FlightResult`, `ProgressEvent`, `SearchStatus` | Core domain; also has `FlightResultsOutput` (unused) |
| `requests.py` | `FlightSearchRequest` | Includes `openai_api_key: Optional[str]` field |
| `responses.py` | `HealthResponse`, `SearchResponse`, `StatusResponse`, `FlightSearchResult`, `ErrorResponse` | API response models |

**Files**:
- `app/models/__init__.py`, `app/models/enums.py`, `app/models/domain.py`, `app/models/requests.py`, `app/models/responses.py`

### US-3.5: Routes

**Status**: `COMPLETED`

Three route modules:

#### `app/routes/health.py` — Health Check
- `GET /health` → `{"status": "ok"}`

#### `app/routes/search.py` — Search Trigger + Status
- `POST /search` — Validates `FlightSearchRequest`, starts background `asyncio.create_task(_run_search(...))`, returns `{"search_id": ..., "status": "running"}` immediately
- `GET /status/{search_id}` — Returns current status, progress events array, results, and error from module-level `_active_searches` dict

#### `app/routes/websocket.py` — Real-Time Progress
- `WS /ws/search/{search_id}` — Accepts WebSocket, polls `_active_searches` every 10 seconds, streams progress events and completion/failure status, tracks `last_sent_index` to avoid duplicates

**Files**:
- `app/routes/__init__.py`, `app/routes/health.py`, `app/routes/search.py`, `app/routes/websocket.py`

### US-3.6: Search Service (Core Pipeline)

**Status**: `COMPLETED`

The search service (`app/services/search.py`) implements the core flight search pipeline using **direct browser automation** (NOT the browser-use Agent class).

**Pipeline — `_run_search()` function**:

| Step | Description | Implementation |
|------|-------------|----------------|
| 0 | Initialize stealth browser | `create_stealth_browser()` → Playwright Chromium with CDP stealth JS |
| 1 | Build Kayak URL | `build_kayak_url(origin, destination, date, cabin, direct)` |
| 2 | Navigate to Kayak | `page.goto(url)` + 15-second wait for results to load |
| 3 | Extract flight data | `page.evaluate(EXTRACTION_JS)` — DOM scraper JavaScript |
| 4 | Parse extracted text | `_parse_extraction()` → `try_parse_plain_text_flights()` from `text_parser.py` |
| 5 | Complete | Store results, notify callback |

**State management**:
- Module-level `_active_searches: dict` stores `SearchStatus` objects keyed by `search_id`
- `asyncio.Semaphore(max_concurrent_searches)` for concurrency control
- Each progress step appends a `ProgressEvent` with optional screenshot (base64)
- On completion, POSTs results to Next.js callback via `notify_callback()`

**Error handling**:
- Try/except wrapping entire pipeline
- On failure: status set to `"failed"`, error message stored, callback notified with `status: "failed"`
- Browser always closed in `finally` block

**Files**:
- `app/services/search.py` — Core search pipeline + `_active_searches` state
- `app/services/__init__.py`

### US-3.7: Browser Service

**Status**: `COMPLETED`

Stealth browser creation and management:

- `create_stealth_browser()` — Launches Playwright Chromium (headless), injects `STEALTH_JS` via CDP `Page.addScriptToEvaluateOnNewDocument`, sets random user-agent from `USER_AGENTS` list
- `take_screenshot(page)` — Captures full-page screenshot, returns base64 string
- `close_browser(browser, context)` — Safely closes context and browser with error handling

**Files**:
- `app/services/browser.py` — Browser lifecycle management

### US-3.8: Callback Service

**Status**: `COMPLETED`

- `notify_callback(search_id, status, results, error)` — Async HTTP POST to Next.js callback endpoint
- Posts to `settings.nextjs_callback_url` (default: `http://nextjs:3000/api/callback/search-complete`)
- 10-second timeout, logs warnings on failure (non-blocking)

**Files**:
- `app/services/callback.py` — Callback notification

### US-3.9: Stealth Constants

**Status**: `COMPLETED`

- `USER_AGENTS` — List of 5 realistic Chrome user-agent strings for rotation
- `STEALTH_JS` — CDP JavaScript that overrides `navigator.webdriver`, `navigator.plugins`, `navigator.languages`, `chrome.runtime`, `Notification.permission`, and `navigator.permissions.query` to evade bot detection

**Files**:
- `app/constants/stealth.py` — User agents + stealth overrides
- `app/constants/__init__.py`

### US-3.10: DOM Extraction JavaScript

**Status**: `COMPLETED`

`EXTRACTION_JS` — A JavaScript function executed via `page.evaluate()` that:
1. Queries all DOM elements with class `[class*="resultInner"]` (Kayak result cards)
2. Extracts airline, price, departure/arrival times, duration, stops from each card
3. Returns a JSON string array of flight result objects
4. Falls back to `document.body.innerText` if no structured results found

**Files**:
- `app/constants/selectors.py` — `EXTRACTION_JS` constant

### US-3.11: Text Parser (Active)

**Status**: `COMPLETED`

The **actively used** parser for converting raw extraction output to `FlightResult` objects:

- `parse_raw_text_to_flight(text)` — Regex-based parser that extracts airline, times, duration, stops, price from a single flight text block
- `try_parse_plain_text_flights(raw_text)` — Splits raw text by flight-like boundaries, attempts to parse each block, returns list of `FlightResult` objects

**Parsing strategy**:
1. Try JSON parse first (`json.loads`)
2. Try `fix_malformed_json()` from `json_fixer.py`
3. Fall back to `try_parse_plain_text_flights()` regex parsing

**Files**:
- `app/parsers/text_parser.py` — Active text parser
- `app/parsers/__init__.py`

### US-3.12: JSON Fixer

**Status**: `COMPLETED`

Utilities for handling malformed JSON from DOM extraction:

- `fix_malformed_json(text)` — Attempts to repair common JSON issues (trailing commas, unquoted keys, etc.)
- `extract_individual_objects(text)` — Extracts individual JSON objects from a text that may contain multiple objects without proper array wrapping

**Files**:
- `app/parsers/json_fixer.py` — JSON repair utilities

### US-3.13: Kayak URL Builder (Active)

**Status**: `COMPLETED`

- `build_kayak_url(origin, destination, date, cabin_class, direct_only)` — Constructs a Kayak flight search URL with proper path segments and query parameters (sort by price, cabin class mapping, nonstop filter)

**Files**:
- `app/prompts/kayak.py` — `build_kayak_url()` function (actively used)

### US-3.14: Dead Code (Present but Unused)

The following code exists in the codebase but is **never called** at runtime:

| File | Dead Code | Why |
|------|-----------|-----|
| `app/parsers/flight_parser.py` | 7-strategy multi-parser (`parse_flight_results`, `_try_strategies`) | Was designed for Agent-based extraction; search pipeline uses `text_parser.py` instead |
| `app/prompts/kayak.py` | `build_flight_search_prompt()` | Prompt template for Agent — not used since search is direct automation |
| `app/prompts/extraction.py` | `build_extraction_prompt()` | LLM extraction prompt — not used since extraction is via JavaScript DOM scraping |
| `app/models/domain.py` | `FlightResultsOutput` | Response model for Agent-based flow, never instantiated |

---

## Epic 4 — Next.js Frontend (Pages & Layout)

### US-4.1: Root Layout & Theme

**Status**: `COMPLETED`

- Root layout with `ThemeProvider` from `next-themes` (`attribute="class"`, `defaultTheme="dark"`)
- Dark/light mode support via `ThemeToggle` component (not rendered in layout currently)
- Inter font from `next/font/google`
- Navbar + Footer rendered in layout
- `globals.css` with Tailwind v4 CSS-first config: `@import "tailwindcss"`, `@import "tw-animate-css"`, `@custom-variant dark (&:where(.dark, .dark *))`
- Custom CSS properties for brand colors, glass morphism effects, gradient utilities

**Files**:
- `frontend/src/app/layout.tsx` — Root layout
- `frontend/src/app/globals.css` — Global styles + Tailwind v4 config
- `frontend/src/components/theme-provider.tsx` — ThemeProvider wrapper
- `frontend/src/components/theme-toggle.tsx` — Theme toggle button

### US-4.2: Home Page

**Status**: `COMPLETED`

- Hero section with gradient text, animated background grid
- `SearchForm` component for flight search input
- `useFlightSearch()` hook handles form submission → POST `/api/search` → redirect to `/history/{searchId}`
- Features grid highlighting AI-powered search, stealth automation, real-time tracking, vector memory

**Files**:
- `frontend/src/app/page.tsx` — Home page

### US-4.3: Execution Page (`/history/[id]`)

**Status**: `COMPLETED`

Real-time search execution monitoring page:

- **AgentStatus** badge showing current status (idle → connecting → running → completed/error)
- **LLM Provider badge** displaying `llm_provider`/`llm_model` from agent_ctx (e.g., "ollama • qwen3:8b")
- **ExecutionTimeline** component rendering progress events with icons, timestamps, expandable details
- **Agent Output panel** — Collapsible JSON viewer showing raw agent output with "Copy JSON" button
- **"View Results" button** — Links to `/results/{id}` when search completes
- **Data flow**: `useSearchExecution(searchId)` hook connects via WebSocket to `ws://browser-use:8000/ws/search/{id}`, with HTTP polling fallback to `GET /status/{id}` (browser-use) and `GET /api/status/{id}` (Next.js DB-backed)
- **DB result polling**: Periodically fetches `GET /api/results/{id}` to check for persisted results

**Files**:
- `frontend/src/app/history/[id]/page.tsx` — Execution page

### US-4.4: Results Page (`/results/[id]`)

**Status**: `COMPLETED`

Flight results display with sorting and filtering:

- **Sort options**: Price (default), Duration, Departure — ascending toggle
- **Filter**: Direct flights only switch
- **FlightCard** grid rendering each result
- **parseDurationMinutes()** helper for duration-based sorting (e.g., "7h 30m" → 450)
- **Search summary** header showing origin → destination, date, cabin class, LLM provider
- **Empty state** for no results / no matching filters
- Fetches data from `GET /api/results/{id}`

**Files**:
- `frontend/src/app/results/[id]/page.tsx` — Results page

### US-4.5: Settings Page

**Status**: `COMPLETED`

Service connectivity test dashboard with 4 tabbed panels:

| Tab | Component | Hook | API Route |
|-----|-----------|------|-----------|
| Ollama | `OllamaConnectionTest` | `useOllamaConnectionTest` | `GET /api/ai/ollama-test` (streaming) |
| Database | `DatabaseConnectionTest` | `useDatabaseConnectionTest` | `GET /api/db/test-connection` + `GET /api/db/test-pgvector` |
| Browser-Use | `BrowserUseHealthTest` | `useBrowserUseHealthTest` | `GET /api/browser-use/health` |
| System | `SystemStatus` | `useSystemStatus` | `GET /api/system/status` |

Each tab shows a Card with test button, status badge (Connected/Healthy/Error), and detailed results.

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

---

## Epic 5 — Next.js API Routes

### US-5.1: Health Check

**Status**: `COMPLETED`

- `GET /api/health` → `{ status: "ok", timestamp: ISO }` — Used by Docker healthcheck

**Files**:
- `frontend/src/app/api/health/route.ts`

### US-5.2: Search Trigger

**Status**: `COMPLETED`

`POST /api/search` — Main search initiation endpoint:

1. Validates request body (origin, destination, departureDate, cabinClass, directOnly, openaiApiKey)
2. **Cache lookup**: Queries `agent_ctx` + `agent_state` for matching completed search within `CACHE_TTL_MINUTES` (skipped when OpenAI API key is provided)
3. Creates `agent_ctx` row with `llm_provider` and `llm_model` (determined by presence of `openaiApiKey`)
4. Creates `agent_state` row with `status: 'running'`, `started_at: NOW()`
5. **Fire-and-forget** POST to `${BROWSER_USE_API_URL}/search` with search params + search_id
6. Returns `{ searchId, status: "running" }` (or cached `searchId` with `status: "completed"`)

**LLM provider logic** (stored in DB, not used at runtime):
- If `openaiApiKey` provided: `llm_provider = "openai"`, `llm_model = "gpt-4.1-mini"`
- Otherwise: `llm_provider = "ollama"`, `llm_model = "qwen3:8b"`

**Files**:
- `frontend/src/app/api/search/route.ts`

### US-5.3: Results Retrieval

**Status**: `COMPLETED`

`GET /api/results/[id]` — Fetch flight results for a search:

- Returns search context (origin, destination, dates, cabin class)
- Returns LLM info (`provider`, `model`) from `agent_ctx`
- Returns agent state status
- Returns flight results array (sorted by price ASC)
- Falls back to `raw_data` JSONB when TIMESTAMPTZ columns are null (handles "6:25 pm" style time strings)

**Response shape**: `{ searchId, status, error?, searchParams, llm: { provider, model }, results[] }`

**Note**: `verified` and `verified_at` columns exist in DB but are NOT returned in this endpoint's response.

**Files**:
- `frontend/src/app/api/results/[id]/route.ts`

### US-5.4: Status Polling

**Status**: `COMPLETED`

`GET /api/status/[id]` — DB-backed polling fallback for search status:

- Returns `status`, `error`, `startedAt`, `completedAt` from `agent_state`
- If `status === "completed"`, also queries and returns flight results
- Used as final fallback when WebSocket and browser-use HTTP status are unavailable

**Files**:
- `frontend/src/app/api/status/[id]/route.ts`

### US-5.5: Search Completion Callback

**Status**: `COMPLETED`

`POST /api/callback/search-complete` — Invoked by browser-use service on search completion:

**On `status: "completed"`**:
1. Inserts each flight result into `flight_results` table (with `tryParseTimestamp()` for time values)
2. Updates `agent_state` to `completed` with `completed_at`
3. Generates a search summary text (cheapest flight, route, result count)
4. Generates vector embedding via `generateEmbedding()` (Ollama nomic-embed-text)
5. Stores memory entry with embedding in `memory` table
6. Falls back to storing without embedding if Ollama is unavailable

**On `status: "failed"`**:
1. Updates `agent_state` to `failed` with error message
2. Stores failure summary as memory entry (with embedding attempt)

**Files**:
- `frontend/src/app/api/callback/search-complete/route.ts`

### US-5.6: Ollama AI Test

**Status**: `COMPLETED`

`GET /api/ai/ollama-test` — Streaming AI SDK test:

- Uses `streamText()` from `ai` package with `localOllama(OLLAMA_MODEL)`
- Sends a brief "confirm you are operational" prompt
- Returns streaming text response via `result.toTextStreamResponse()`

**Files**:
- `frontend/src/app/api/ai/ollama-test/route.ts`

### US-5.7: Browser-Use Health Proxy

**Status**: `COMPLETED`

`GET /api/browser-use/health` — Proxies health check to browser-use service:

- Fetches `${BROWSER_USE_API_URL}/health` with 5-second timeout
- Returns `{ status: "ok", serviceStatus, url }`

**Files**:
- `frontend/src/app/api/browser-use/health/route.ts`

### US-5.8: Database Connection Test

**Status**: `COMPLETED`

`GET /api/db/test-connection` — Tests PostgreSQL connectivity:

- Connects via `pg.Client`, executes `SELECT version()` via Drizzle ORM
- Returns `{ status: "connected", version }`

**Files**:
- `frontend/src/app/api/db/test-connection/route.ts`

### US-5.9: pgvector Extension Test

**Status**: `COMPLETED`

`GET /api/db/test-pgvector` — Tests pgvector operations:

- Checks `pg_extension` for vector extension
- Creates temp table, inserts test vectors, performs distance query
- Returns `{ status: "pgvector_active", pgvectorVersion, test: { nearestId, distance } }`

**Files**:
- `frontend/src/app/api/db/test-pgvector/route.ts`

### US-5.10: Memory Storage

**Status**: `COMPLETED`

`POST /api/memory` — Store agent step summary with embedding:

- Accepts `{ agent_ctx_id, content, step_number? }`
- Generates embedding via `generateEmbedding(content)` (Ollama)
- Inserts into `memory` table with embedding vector
- Falls back to storing without embedding on failure

**Files**:
- `frontend/src/app/api/memory/route.ts`

### US-5.11: Semantic Memory Search

**Status**: `COMPLETED`

`GET /api/memory/search?q=...&limit=10` — Vector similarity search over agent memory:

- Generates embedding for query text
- Cosine similarity search using `<=>` operator (pgvector)
- JOINs with `agent_ctx` for search context
- Returns `{ query, count, memories[] }` with similarity scores
- Max 50 results

**Files**:
- `frontend/src/app/api/memory/search/route.ts`

### US-5.12: System Status

**Status**: `COMPLETED`

`GET /api/system/status` — Aggregate health check for all services:

- Checks Ollama (`GET /api/tags`), Browser-Use (`GET /health`), PostgreSQL (pool connect)
- Returns service health status with latency measurements
- Returns row counts for all 4 application tables
- Returns `{ status: "healthy"|"degraded", timestamp, services[], tableCounts }`

**Files**:
- `frontend/src/app/api/system/status/route.ts`

### US-5.13: Flight Result Verification (Stub)

**Status**: `COMPLETED`

`POST /api/verify/[id]` — Stub endpoint for multi-source verification:

- Updates `flight_results` row: `verified = TRUE`, `verified_at = NOW()`
- Returns `{ id, verified: true, verifiedAt, message }` with stub notice
- Production would re-scrape booking URL and cross-reference sources

**Files**:
- `frontend/src/app/api/verify/[id]/route.ts`

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

**Total: 13 API routes**

---

## Epic 6 — Frontend Components

### US-6.1: SearchForm

**Status**: `COMPLETED`

Flight search form with:
- **Fields**: Origin, Destination (airport codes), Departure Date, Return Date (optional), Cabin Class (economy/business/first), Direct Only toggle
- **Date pickers**: Popover + Calendar component, disables past dates
- **Advanced Options**: Collapsible section with OpenAI API Key input (password field, `sk-...` placeholder)
- **Validation**: `react-hook-form` + Zod via `@hookform/resolvers/zod`
- **Submit**: Calls `onSubmit(data)` prop with validated `FlightSearchParams`
- **UI**: Glass morphism cards, gradient submit button with loading spinner, icon-decorated inputs

**Files**:
- `frontend/src/components/SearchForm/SearchForm.tsx` — Form component
- `frontend/src/components/SearchForm/types.ts` — Props interface
- `frontend/src/components/SearchForm/hooks/useFlightSearch.ts` — Submit handler hook (POST → redirect)
- `frontend/src/components/SearchForm/index.ts` — Barrel export

### US-6.2: FlightCard

**Status**: `COMPLETED`

Flight result card with:
- **Airline** name + origin/destination codes
- **Times**: Departure → arrival with animated route line and stop indicator
- **Duration** display
- **Stops** badge (Non-stop / X stops)
- **Price** display with currency symbol + `.00` suffix
- **Rank badges**: "Best Value" (rank 1, purple) and "Cheapest" (rank 2, green)
- **Verification badge**: ShieldCheck (verified, green) or ShieldAlert (unverified, gray)
- **Select button**: External link to `flight.url` or plain button
- **safeFormatTime()** helper handles both ISO dates and plain time strings

**Files**:
- `frontend/src/components/FlightCard/FlightCard.tsx` — Card component
- `frontend/src/components/FlightCard/types.ts` — Props interface (`FlightCardProps`)
- `frontend/src/components/FlightCard/index.ts` — Barrel export

### US-6.3: ExecutionTimeline

**Status**: `COMPLETED`

Real-time agent execution timeline with:
- **Timeline UI**: Vertical line connecting event nodes with icons
- **Event types**: `status` (shield), `progress` (brain/globe), `done` (check circle), `error` (alert circle)
- **Icon states**: Active progress events get gradient glow, completed get purple border, status events are dimmed until subsequent events exist
- **Status badges**: "Queueing", "In Progress" (with pulse), "Completed", "Error"
- **Expandable details**: Thinking (purple), Evaluation (amber), Memory (cyan), Actions (orange JSON), Screenshot display
- **Auto-scroll**: Scrolls to latest event via ref
- **Loading state**: Spinner with "Waiting for agent to start..." text

**Files**:
- `frontend/src/components/ExecutionTimeline/ExecutionTimeline.tsx` — Timeline component
- `frontend/src/components/ExecutionTimeline/types.ts` — Props interface
- `frontend/src/components/ExecutionTimeline/hooks/useSearchExecution.ts` — WebSocket + polling hook
- `frontend/src/components/ExecutionTimeline/index.ts` — Barrel export

### US-6.4: useSearchExecution Hook

**Status**: `COMPLETED`

Dual-mode execution tracking hook:

**WebSocket (primary)**:
- Connects to `ws://{hostname}:8000/ws/search/{searchId}`
- Handles: `status`, `progress` (with screenshot, thinking, evaluation, memory, actions), `done`, `error` events
- React StrictMode safe: Uses `wsIdRef` to detect/discard stale callbacks
- Graceful degradation: WS errors silently fall through to polling

**HTTP Polling (fallback)**:
- Polls `GET http://{hostname}:8000/status/{searchId}` (browser-use direct) every 10 seconds
- Falls back to `GET /api/status/{searchId}` (Next.js DB-backed)
- Tracks `polledProgressCountRef` to avoid duplicate events
- Skips polling when WS is actively delivering data (`wsDeliveredRef`)
- Initial poll delayed 3 seconds to avoid duplicating WS catch-up events

**State management**: `SearchExecutionState` with `status`, `events[]`, `error?`, `results?`

**Files**:
- `frontend/src/components/ExecutionTimeline/hooks/useSearchExecution.ts`

### US-6.5: AgentStatus

**Status**: `COMPLETED`

Status badge component with 5 states:
- **Idle**: WifiOff icon, gray badge
- **Connecting**: Spinning Loader2, amber badge
- **Running**: Spinning Loader2 with ping dot, electric blue badge
- **Completed**: CheckCircle2, emerald badge + result count
- **Error**: AlertCircle, red badge + error message + Retry button

**Files**:
- `frontend/src/components/AgentStatus/AgentStatus.tsx` — Status component
- `frontend/src/components/AgentStatus/types.ts` — Props interface (`AgentStatusProps`, `AgentFlightResult`)
- `frontend/src/components/AgentStatus/index.ts` — Barrel export

### US-6.6: Navbar

**Status**: `COMPLETED`

Sticky top navigation with:
- **Logo**: Gradient plane icon + "AeroAgent AI" + "Swarm Control Center" subtitle
- **Nav links**: Dashboard (`/`), History (`/history`), Results (`/results`), Settings (`/settings`)
- **Active state**: Bold text on current route (pathname match or prefix match)
- **LIVE indicator**: Pulsing green dot with "LIVE" text
- **Glass panel** effect with border

**Files**:
- `frontend/src/components/Navbar/Navbar.tsx` — Navigation component
- `frontend/src/components/Navbar/types.ts` — `NavbarProps`, `NavLink` types
- `frontend/src/components/Navbar/index.ts` — Barrel export

### US-6.7: Footer

**Status**: `COMPLETED`

Full-width footer with:
- **Brand column**: Logo + description + social icons (Twitter, GitHub placeholders)
- **Link columns**: Product (Agents, Cloud API), Company (About, Privacy), Support (Docs, Status)
- **Bottom bar**: Copyright year + "Powered by AeroAgent" badge
- **Dark bg**: `bg-[#050505]` with border

**Files**:
- `frontend/src/components/Footer/Footer.tsx` — Footer component
- `frontend/src/components/Footer/types.ts` — `FooterProps` type
- `frontend/src/components/Footer/index.ts` — Barrel export

### US-6.8: shadcn/ui Primitives

**Status**: `COMPLETED`

11 shadcn/ui components installed in `frontend/src/components/ui/`:

| Component | File | Usage |
|-----------|------|-------|
| Badge | `badge.tsx` | Status indicators, rank badges |
| Button | `button.tsx` | Form submit, actions, navigation |
| Calendar | `calendar.tsx` | Date picker popover content |
| Card | `card.tsx` | Settings test panels |
| Form | `form.tsx` | SearchForm (react-hook-form integration) |
| Input | `input.tsx` | Text fields (origin, destination, API key) |
| Label | `label.tsx` | Form labels |
| Popover | `popover.tsx` | Date picker wrapper |
| Select | `select.tsx` | Cabin class dropdown |
| Switch | `switch.tsx` | Direct flights toggle |
| Tabs | `tabs.tsx` | Settings page tabs |

**Files**:
- `frontend/src/components/ui/*.tsx` — 11 shadcn/ui primitive components

---

## Epic 7 — Library & Type System

### US-7.1: Ollama Provider

**Status**: `COMPLETED`

AI SDK 6 OpenAI-compatible provider for Ollama:
- `createOpenAICompatible()` from `@ai-sdk/openai-compatible`
- Base URL: `${OLLAMA_HOST}/v1`
- API key: `"not-required"` (local)
- Exported `OLLAMA_MODEL = "qwen3:8b"`

**Files**:
- `frontend/src/lib/localOllama.ts`

### US-7.2: Supabase Client

**Status**: `COMPLETED`

- `supabase` client via `@supabase/supabase-js` `createClient()` (client-side, minimal usage)
- `DATABASE_URL` export for server-side Drizzle/pg connections

**Files**:
- `frontend/src/lib/supabase.ts`

### US-7.3: Embedding Generation

**Status**: `COMPLETED`

Ollama-powered vector embedding utilities:
- `generateEmbedding(text, model?)` — POST to `${OLLAMA_HOST}/api/embeddings` with model `nomic-embed-text`
- `generateEmbeddings(texts, model?)` — Batch wrapper using `Promise.all`
- Returns 1536-dimension number arrays

**Files**:
- `frontend/src/lib/embeddings.ts`

### US-7.4: Utility Functions

**Status**: `COMPLETED`

- `cn(...inputs)` — Tailwind CSS class merge utility (clsx + tailwind-merge)

**Files**:
- `frontend/src/lib/utils.ts`

### US-7.5: Zod Validation Schemas

**Status**: `COMPLETED`

- `flightSearchParamsSchema` — Validates origin, destination, departureDate, returnDate?, cabinClass, directOnly, openaiApiKey?
- `searchResponseSchema` — Validates `{ searchId, status, error? }`
- Exported types: `FlightSearchParams`, `SearchResponse`

**Files**:
- `frontend/src/lib/schemas/flightSearch.ts`

### US-7.6: TypeScript Type Definitions

**Status**: `COMPLETED`

#### `AgentEvent` types:
- `AgentEventType` — `"status" | "progress" | "done" | "error"`
- `AgentEvent` — `{ id, timestamp, type, message, screenshotUrl?, data? }`
- `SearchExecutionStatus` — `"idle" | "connecting" | "running" | "completed" | "error"`
- `SearchExecutionState` — `{ status, events, error?, results? }`
- `FlightResultData` — Agent-returned flight data shape

#### `FlightResult` types:
- `FlightResult` — `{ id, searchId, airline, departure, arrival, duration, stops, price, currency, url?, origin?, destination?, cabinClass?, verified?, verifiedAt? }`
- `FlightSortField` — `"price" | "duration" | "departure"`
- `SortDirection` — `"asc" | "desc"`
- `FlightFilters` — `{ directOnly: boolean }`

**Files**:
- `frontend/src/lib/types/agentEvent.ts`
- `frontend/src/lib/types/flightResult.ts`

---

## Epic 8 — Dependencies & Build Configuration

### US-8.1: Frontend Dependencies

**Status**: `COMPLETED`

**package.json** — Next.js 16.1.6, React 19.2.3

**Production dependencies**:
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | `16.1.6` | App framework |
| `react` / `react-dom` | `19.2.3` | UI library |
| `ai` | `^6.0.77` | AI SDK streaming |
| `@ai-sdk/openai-compatible` | `^2.0.28` | Ollama provider |
| `@supabase/supabase-js` | `^2.95.3` | Supabase client |
| `drizzle-orm` | `^0.45.1` | ORM for PostgreSQL |
| `pg` | `^8.18.0` | PostgreSQL driver |
| `zod` | `^4.3.6` | Schema validation |
| `react-hook-form` | `^7.71.1` | Form management |
| `@hookform/resolvers` | `^5.2.2` | Zod resolver for forms |
| `next-themes` | `^0.4.6` | Dark/light mode |
| `lucide-react` | `^0.563.0` | Icons |
| `radix-ui` | `^1.4.3` | UI primitives |
| `class-variance-authority` | `^0.7.1` | Component variants |
| `clsx` | `^2.1.1` | Conditional classes |
| `tailwind-merge` | `^3.4.0` | Tailwind class merge |
| `date-fns` | `^4.1.0` | Date formatting |
| `react-day-picker` | `^9.13.1` | Calendar component |
| `jotai` | `^2.17.1` | Installed but unused |

**Dev dependencies**:
| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | `^4` | CSS framework |
| `@tailwindcss/postcss` | `^4` | PostCSS plugin |
| `tw-animate-css` | `^1.4.0` | Animation utilities |
| `typescript` | `^5` | TypeScript compiler |
| `@types/node` | `^20` | Node.js types |
| `@types/react` / `@types/react-dom` | `^19` | React types |
| `@types/pg` | `^8.16.0` | PostgreSQL types |
| `eslint` / `eslint-config-next` | `^9` / `16.1.6` | Linting |
| `shadcn` | `^3.8.4` | Component CLI |

**Files**:
- `frontend/package.json`

### US-8.2: Browser-Service Dependencies

**Status**: `COMPLETED`

**pyproject.toml** — Python 3.12, ruff linter config

**Key dependencies** (from `requirements.txt`):
- `fastapi` + `uvicorn` — Web framework
- `browser-use` — Browser automation library
- `playwright` — Browser control
- `pydantic` + `pydantic-settings` — Validation + config
- `langchain-ollama` — ChatOllama provider (imported but not used at runtime for search)
- `httpx` — Async HTTP client

**Files**:
- `browser-service/pyproject.toml` — Project metadata + linter config
- `browser-service/requirements.txt` — Pinned dependencies

### US-8.3: Build Configuration

**Status**: `COMPLETED`

- `frontend/next.config.ts` — Next.js configuration
- `frontend/tsconfig.json` — TypeScript strict mode, path aliases (`@/` → `src/`)
- `frontend/postcss.config.mjs` — PostCSS with `@tailwindcss/postcss`
- `frontend/eslint.config.mjs` — ESLint configuration
- `frontend/components.json` — shadcn/ui configuration (new-york style, CSS variables, path aliases)

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
| `services/browser.py` | Stealth browser creation, screenshots, cleanup |
| `services/callback.py` | HTTP callback to Next.js |
| `services/search.py` | Core search pipeline (_run_search) |
| `parsers/__init__.py` | Parsers package init |
| `parsers/text_parser.py` | Active: regex text → FlightResult parser |
| `parsers/flight_parser.py` | Dead code: 7-strategy multi-parser |
| `parsers/json_fixer.py` | JSON repair utilities |
| `constants/__init__.py` | Constants package init |
| `constants/stealth.py` | USER_AGENTS, STEALTH_JS |
| `constants/selectors.py` | EXTRACTION_JS (DOM scraper) |
| `prompts/__init__.py` | Prompts package init |
| `prompts/kayak.py` | build_kayak_url() (active), build_flight_search_prompt() (dead) |
| `prompts/extraction.py` | build_extraction_prompt() (dead) |

### Frontend (`frontend/src/`) — 43+ TypeScript/TSX files

#### Pages (App Router)
| File | Route | Description |
|------|-------|-------------|
| `app/layout.tsx` | — | Root layout (ThemeProvider, Navbar, Footer) |
| `app/page.tsx` | `/` | Home (SearchForm, hero, features) |
| `app/globals.css` | — | Tailwind v4 config + custom styles |
| `app/history/[id]/page.tsx` | `/history/[id]` | Execution timeline + status |
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

#### Components
| Directory | Files | Purpose |
|-----------|-------|---------|
| `components/SearchForm/` | SearchForm.tsx, types.ts, hooks/useFlightSearch.ts, index.ts | Flight search form |
| `components/FlightCard/` | FlightCard.tsx, types.ts, index.ts | Result card display |
| `components/ExecutionTimeline/` | ExecutionTimeline.tsx, types.ts, hooks/useSearchExecution.ts, index.ts | Real-time timeline |
| `components/AgentStatus/` | AgentStatus.tsx, types.ts, index.ts | Status badge |
| `components/Navbar/` | Navbar.tsx, types.ts, index.ts | Top navigation |
| `components/Footer/` | Footer.tsx, types.ts, index.ts | Page footer |
| `components/settings/` | index.tsx, 4 test components (each with hooks/) | Settings tabs |
| `components/ui/` | 11 shadcn/ui primitives | UI building blocks |
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
| `README-PLAN.md` | Architecture reference |
| `README-SKILLS.md` | Skill authoring conventions |

---

## Notes

### Installed but Unused Dependencies
- **Jotai** (`^2.17.1`): Installed in `package.json` but no atoms are defined or used anywhere in the codebase. State management uses local `useState`/`useRef` hooks exclusively.

### Dead Code Summary
The browser-service contains several modules that were built for an Agent-based architecture but are not used in the current direct-automation pipeline:
- `app/parsers/flight_parser.py` — 7-strategy multi-parser (never imported by search pipeline)
- `app/prompts/kayak.py::build_flight_search_prompt()` — Agent prompt template
- `app/prompts/extraction.py::build_extraction_prompt()` — LLM extraction prompt
- `app/models/domain.py::FlightResultsOutput` — Agent response model

These files are retained for potential future use if the Agent-based approach is re-enabled.
