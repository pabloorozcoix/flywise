# AeroAgent AI

> AI-powered flight search running **100 % locally** — no API keys required, no cloud costs, full data privacy.

An LLM-driven browser agent navigates Kayak, extracts results, and presents them through a modern Next.js interface. The entire stack — LLM inference, browser automation, database — runs inside Docker Compose on your machine. Optionally, bring your own **OpenAI API key** for faster, more accurate extraction using models like `gpt-4.1-mini`.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Quick Start — First Time Setup](#quick-start--first-time-setup)
- [Stopping & Restarting](#stopping--restarting)
- [Wiping Everything (Clean Reset)](#wiping-everything-clean-reset)
- [Optional: OpenAI Support](#optional-openai-support)
- [Development vs Production Mode](#development-vs-production-mode)
- [Makefile Reference](#makefile-reference)
- [Development Workflow](#development-workflow)
- [Service Deep Dive — Frontend (Next.js)](#service-deep-dive--frontend-nextjs)
- [Service Deep Dive — Browser-Use (Python FastAPI)](#service-deep-dive--browser-use-python-fastapi)
- [Service Deep Dive — Supabase DB (PostgreSQL + pgvector)](#service-deep-dive--supabase-db-postgresql--pgvector)
- [Inter-Service Communication](#inter-service-communication)
- [How a Search Works (End-to-End)](#how-a-search-works-end-to-end)
- [Application Sections](#application-sections)
- [Testing](#testing)
- [Patterns & Standards](#patterns--standards)
- [Service Endpoints](#service-endpoints)
- [Environment Variables](#environment-variables)
- [Docker Networking](#docker-networking)
- [Health Checks](#health-checks)
- [Debugging & Monitoring](#debugging--monitoring)
- [Troubleshooting](#troubleshooting)
- [Project Status](#project-status)
- [Spec-Driven Development](#spec-driven-development)
- [License](#license)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Docker Compose  ·  aeroagent network           │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              nextjs  ·  localhost:3000                       │   │
│  │  React UI (search form,     │  API Routes (TypeScript)       │   │
│  │  execution timeline,        │  POST /api/search              │   │
│  │  flight results)            │  GET  /api/results/[id]        │   │
│  │  AI SDK 6 + shadcn/ui       │  WS   proxy → browser-use      │   │
│  └─────────────────────────────┴────────────────────────────────┘   │
│                │                   │                   │            │
│       ┌────────┘          ┌────────┘          ┌────────┘            │
│       ▼                   ▼                   ▼                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐       │
│  │  ollama      │  │  browser-use │  │  supabase-db         │       │
│  │  :11434      │  │  :8000       │  │  :5432               │       │
│  ├──────────────┤  ├──────────────┤  ├──────────────────────┤       │
│  │ qwen3:8b     │  │ FastAPI 0.2  │  │ PostgreSQL 17        │       │
│  │ OpenAI-compat│  │ browser-use  │  │ pgvector (1536-dim)  │       │
│  │ local infer. │  │ Chromium     │  │ Drizzle ORM schema   │       │
│  └──────────────┘  │ Stealth CDP  │  └──────────────────────┘       │
│         ▲          │ 7-strategy   │                                 │
│         │          │ parser       │                                 │
│         │          └──────────────┘                                 │
│         │                  │                                        │
│  ┌──────┴──────┐           │ (optional)                             │
│  │  OpenAI API │◀──────────┘                                        │
│  │  (optional) │  User-provided API key                             │
│  │  gpt-4.1-*  │  for faster extraction                             │
│  └─────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Data flow:** User submits a search → Next.js API route validates with Zod, checks cache, persists params to PostgreSQL, fires-and-forgets to browser-use → browser-use opens a stealth Chromium via CDP, navigates to Kayak, waits for render, injects extraction JS, applies a 7-strategy parser → results stream to the frontend in real time via WebSocket + HTTP polling fallback → browser-use POSTs results back to Next.js callback → Next.js persists flights, generates a vector embedding summary, and marks the search complete.

---

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui | UI, API routes, SSR |
| **State** | Jotai, react-hook-form + Zod v4 | Client state, form validation |
| **AI (TS)** | AI SDK 6, `@ai-sdk/openai-compatible` v2 | LLM streaming from Ollama |
| **AI (Python)** | browser-use ≥0.11.9, FastAPI, pydantic-settings | Browser automation agent |
| **LLM** | Ollama (qwen3:8b) — default · OpenAI (gpt-4.1-mini) — optional | Local or cloud inference |
| **Database** | PostgreSQL 17 + pgvector | Search persistence, vector embeddings |
| **Testing** | Vitest, React Testing Library, jsdom, V8 coverage | 100% frontend test coverage |
| **Infra** | Docker Compose, Makefile | Container orchestration |

---

## Repository Layout

```
.
├── frontend/                      # Next.js 16 application
│   ├── Dockerfile                 #   Production multi-stage build (deps → build → runner)
│   ├── Dockerfile.dev             #   Dev single-stage (next dev + HMR)
│   ├── package.json
│   ├── vitest.config.ts           #   Vitest test runner configuration
│   ├── next.config.ts             #   output: "standalone"
│   └── src/
│       ├── __tests__/             #   Shared test infrastructure
│       │   ├── setup.ts           #     Global mocks (Next.js, Radix UI polyfills)
│       │   ├── fixtures/          #     Reusable test data (flights, events, params)
│       │   └── helpers/           #     Shared mock utilities (mockPg.ts)
│       ├── app/                   #   App Router pages + API routes
│       │   ├── page.tsx           #     Home — SearchForm
│       │   ├── history/[id]/      #     Live execution timeline (WebSocket)
│       │   ├── results/[id]/      #     Flight results grid (sort/filter)
│       │   ├── settings/          #     Service connectivity dashboard
│       │   ├── credits/           #     Usage guide, architecture, team roster
│       │   └── api/               #     14 REST + streaming routes
│       ├── components/            #   UI components (directory-per-component)
│       │   ├── ui/                #     shadcn/ui primitives (11 components)
│       │   ├── SearchForm/        #     Flight search form + useFlightSearch hook
│       │   ├── FlightCard/        #     Flight result card
│       │   ├── ExecutionTimeline/ #     Real-time agent progress + useSearchExecution hook
│       │   ├── AgentStatus/       #     Status badge
│       │   ├── Navbar/            #     App navigation
│       │   ├── Footer/            #     App footer
│       │   └── settings/          #     Health test components (4 service tests)
│       ├── db/
│       │   └── schema.ts          #   Drizzle ORM schema (pgvector custom type)
│       └── lib/
│           ├── localOllama.ts     #   AI SDK createOpenAICompatible provider
│           ├── supabase.ts        #   Supabase client + DATABASE_URL export
│           ├── embeddings.ts      #   Ollama-powered vector embedding generation
│           ├── utils.ts           #   cn() class merge utility (shadcn)
│           ├── schemas/
│           │   └── flightSearch.ts #  Zod validation schemas
│           └── types/
│               ├── agentEvent.ts  #   WebSocket event TypeScript types
│               └── flightResult.ts #  Flight result TypeScript types
│
├── browser-service/               # Python 3.12 FastAPI service (layered architecture)
│   ├── Dockerfile                 #   Production build (python:3.12-slim + Chromium + uv)
│   ├── Dockerfile.dev             #   Dev build (uvicorn --reload + volume mount)
│   ├── pyproject.toml             #   Project metadata + ruff linter config
│   ├── requirements.txt           #   Pinned dependencies (7 packages)
│   └── app/                       #   Python package (layered)
│       ├── __init__.py            #     Package marker
│       ├── main.py                #     FastAPI app factory (lifespan, CORS, router)
│       ├── config.py              #     pydantic-settings Settings class
│       ├── logger.py              #     Structured logging (configure_logging + get_logger)
│       ├── models/                #     Pydantic domain models
│       │   ├── enums.py           #       CabinClass, SearchStatusValue enums
│       │   ├── domain.py          #       FlightResult, ProgressEvent, SearchStatus
│       │   ├── requests.py        #       FlightSearchRequest
│       │   └── responses.py       #       HealthResponse, FlightSearchResponse
│       ├── constants/             #     Static config values
│       │   ├── stealth.py         #       USER_AGENTS list, STEALTH_JS CDP injection
│       │   └── selectors.py       #       EXTRACTION_JS DOM scraper
│       ├── prompts/               #     Agent prompt engineering
│       │   ├── kayak.py           #       URL builder + search prompt templates
│       │   └── extraction.py      #       Structured extraction prompt
│       ├── parsers/               #     Multi-strategy result extraction
│       │   ├── json_fixer.py      #       LLM JSON repair (smart quotes, trailing commas)
│       │   ├── text_parser.py     #       Heuristic text → FlightResult parser
│       │   └── flight_parser.py   #       7-strategy parser orchestrator
│       ├── services/              #     Business logic layer
│       │   ├── browser.py         #       Stealth browser lifecycle (create, screenshot, close)
│       │   ├── callback.py        #       POST results to Next.js callback
│       │   └── search.py          #       Search orchestration (semaphore, background task)
│       └── routes/                #     FastAPI endpoint handlers
│           ├── __init__.py        #       api_router aggregation
│           ├── health.py          #       GET /health
│           ├── search.py          #       POST /search, GET /status/{id}
│           └── websocket.py       #       WS /ws/search/{id}
│
├── supabase/
│   └── init.sql                   # DDL: pgvector extension, 4 tables, indexes, grants
│
├── docker-compose.yml             # Production Compose (4 services, aeroagent network)
├── docker-compose.dev.yml         # Dev override (volume mounts + hot reload commands)
├── package.json                   # Root: Husky + lint-staged (dev tooling only)
├── Makefile                       # 30 convenience targets
├── .husky/pre-commit              # Git pre-commit hook (lint + typecheck + tests)
├── .env.example                   # Environment variable template
├── CLAUDE.md                      # Project instructions (conventions, commands, gotchas)
├── SPECS.md                       # Engineering spec — 11 epics, all COMPLETED
├── README-SKILLS.md               # Canonical reference for Claude Code skill authoring
└── .claude/skills/                # 12 reusable AI engineering skills (see Spec-Driven Development)
    ├── add-api-route/             #   Scaffold a Next.js API route
    ├── add-component/             #   Scaffold a React component
    ├── add-fastapi-endpoint/      #   Add a FastAPI endpoint
    ├── browser-use-patterns/      #   Python service patterns reference
    ├── debug-container/           #   Docker container diagnostics
    ├── docker-dev/                #   Docker Compose management
    ├── env-config/                #   Environment variable reference
    ├── frontend-patterns/         #   Next.js patterns reference
    ├── implement-task/            #   Pick + implement next SPECS.md task
    ├── review-specs/              #   Audit SPECS.md vs codebase
    ├── supabase-schema/           #   Database schema + pgvector patterns
    └── test-browser-service/      #   pytest test authoring for browser-service
```

---

## Prerequisites

| Requirement | Minimum | Notes |
|-------------|---------|-------|
| **Docker Desktop** | 4.x | Docker Engine 24+ with Compose V2 |
| **RAM** | 16 GB | Ollama + Chromium are memory-intensive |
| **Disk** | ~20 GB free | Model weights (~12 GB) + container images |
| **GPU** | Optional | NVIDIA GPU accelerates Ollama inference; CPU works fine but slower |
| **macOS** | Supported | GPU passthrough is NVIDIA-only; macOS uses CPU inference |
| **Git** | 2.x | For cloning |
| **Node.js** | 18+ | For pre-commit hooks (Husky + lint-staged) |
| **npm** | 9+ | Comes with Node.js |

> **Node.js is only required on the host for pre-commit hooks.** The application itself runs entirely inside Docker containers — no host-level Node.js or Python needed for running the app.

---

## Quick Start — First Time Setup

Follow these steps **once** to get AeroAgent AI running from scratch.

### 1. Clone & Configure

```bash
git clone <repository-url> aeroagent-ai
cd aeroagent-ai

# Copy environment template (defaults work out of the box)
cp .env.example .env

# Install pre-commit hooks (Husky + lint-staged)
npm install
```

### 2. Start All Services

**Development mode** (recommended — live code reloading, no rebuild on changes):

```bash
make dev           # Builds images + starts 4 containers
make dev-status    # Verify all containers are healthy
```

**Production mode** (optimized builds, no live reloading):

```bash
make up            # Builds optimized images + starts 4 containers
make status        # Verify all containers are healthy
```

> First-time build takes 3–5 minutes (downloading base images, installing dependencies, compiling Next.js).

### 3. Pull the LLM Model

Download the Ollama model (**first time only** — ~12 GB, persists across restarts):

```bash
make pull-model    # docker compose exec ollama ollama pull qwen3:8b
```

### 4. Open the App

| Service | URL |
|---------|-----|
| **AeroAgent UI** | http://localhost:3000 |
| **Settings / Health** | http://localhost:3000/settings |
| **Ollama API** | http://localhost:11434 |
| **Browser-Use API** | http://localhost:8000 |
| **PostgreSQL** | `postgresql://postgres:postgres@localhost:5432/postgres` |

Go to http://localhost:3000, fill in the flight search form, and click **Search Flights**.

---

## Stopping & Restarting

### Stop services (preserves all data)

```bash
make dev-down      # Development mode
make down          # Production mode
```

Your database, search history, and Ollama model weights are all stored in Docker volumes and **persist across stops/restarts**.

### Start again

```bash
make dev           # Development mode — starts instantly (no rebuild)
make up            # Production mode
```

No need to pull the model again — the `ollama_data` volume retains it.

### Restart individual services

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart nextjs browser-use
```

---

## Wiping Everything (Clean Reset)

To **destroy all data** (database, model weights, search history) and start fresh:

```bash
make clean         # Removes all containers, volumes, and networks
```

Then set up from scratch:

```bash
cp .env.example .env    # Only if .env was deleted
make dev                # Rebuild everything
make pull-model         # Re-download the LLM model (~12 GB)
```

> **Warning:** `make clean` is irreversible. All search results, flight data, and agent memory will be permanently deleted.

---

## Optional: OpenAI Support

By default, AeroAgent uses the **local Ollama model** (no API keys needed). For faster, more accurate results:

1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. On the search form, expand **Advanced Options**
3. Paste your OpenAI API key
4. Click **Search Flights**

The agent will use `gpt-4.1-mini` (cheapest vision-capable model). Your key is **not stored** — it's used only for that single search session.

> When an OpenAI key is provided, the result cache is bypassed to ensure fresh results.

---

## Development vs Production Mode

| Aspect | Production (`make up`) | Development (`make dev`) |
|--------|----------------------|------------------------|
| **Next.js** | `node server.js` (standalone build) | `next dev` (HMR, fast refresh) |
| **Python** | `uvicorn app.main:app` | `uvicorn app.main:app --reload` |
| **Frontend source** | Baked into image | Volume-mounted (`frontend/src/` → `/app/src/`) |
| **Python source** | Baked into image | Volume-mounted (`browser-service/` → `/app/`) |
| **Dockerfile** | `Dockerfile` (multi-stage) | `Dockerfile.dev` (single-stage) |
| **Rebuild on code change** | Yes (`make build`) | No — changes reflect instantly |

---

## Makefile Reference

### Production

| Target | Description |
|--------|-------------|
| `make up` | Start all services |
| `make down` | Stop services (preserves volumes) |
| `make build` | Rebuild & restart |
| `make logs` | Follow all logs |
| `make status` | Container status |
| `make pull-model` | Pull `qwen3:8b` model |
| `make clean` | **Destroy** volumes + containers |

### Development

| Target | Description |
|--------|-------------|
| `make dev` | Start with hot reload |
| `make dev-down` | Stop dev services |
| `make dev-build` | Rebuild dev containers (after dependency changes) |
| `make dev-logs` | Follow all dev logs |
| `make dev-status` | Dev container status |
| `make dev-frontend` | Follow Next.js logs only |
| `make dev-browser-use` | Follow browser-use logs only |

### Dependency Management

| Target | Example | Description |
|--------|---------|-------------|
| `make dev-install-frontend` | `PKG="axios"` | npm install inside container |
| `make dev-install-python` | `PKG="httpx"` | uv pip install inside container |

### Interactive Shells

| Target | Description |
|--------|-------------|
| `make shell-frontend` | sh into Next.js container |
| `make shell-browser-use` | bash into browser-use container |
| `make shell-db` | psql into PostgreSQL |

### Local Quality Gates (Pre-Commit Hooks)

These run **on the host** (not inside Docker) for fast feedback during `git commit`.

| Target | Description |
|--------|-------------|
| `make lint-frontend` | ESLint check (frontend) |
| `make lint-fix-frontend` | ESLint auto-fix (frontend) |
| `make typecheck-frontend` | TypeScript type check (`tsc --noEmit`) |
| `make test-frontend` | Vitest unit tests (frontend) |
| `make lint-python` | Ruff check + format verify (browser-service) |
| `make lint-fix-python` | Ruff auto-fix + format (browser-service) |
| `make test-python-local` | pytest unit tests — local (browser-service) |
| **`make quality`** | **Run all quality checks at once** |

---

## Development Workflow

### Frontend (Next.js)

```bash
make dev             # Start dev environment
make dev-frontend    # Watch Next.js logs
```

Edit any file under `frontend/src/` — Next.js HMR picks up changes instantly in the browser.

### Browser Service (Python)

```bash
make dev              # Start dev environment
make dev-browser-use  # Watch Python logs
```

Edit any `.py` file under `browser-service/` — uvicorn's `--reload` picks up changes automatically.

### Database

```bash
make shell-db    # psql interactive shell
```

```sql
\dt                                                          -- List tables
SELECT * FROM agent_ctx ORDER BY created_at DESC LIMIT 5;    -- Recent searches
```

The schema is initialized on first boot via `supabase/init.sql`. To reset, run `make clean` then `make dev`.

### Adding Dependencies

**npm packages** (changes `package.json`):

```bash
make dev-install-frontend PKG="lodash @types/lodash"   # Quick install
make dev-build                                         # OR full rebuild
```

**pip packages** (changes `requirements.txt`):

```bash
make dev-install-python PKG="beautifulsoup4"           # Quick install
make dev-build                                         # OR full rebuild
```

---

## Service Deep Dive — Frontend (Next.js)

The Next.js 16 application (in `frontend/`) serves as both the **user interface** and the **API gateway**. It is the single entry point users interact with and the orchestrator that coordinates the other services.

### How It Works

**Runtime:** Node.js 22 (Alpine). Production uses a multi-stage Docker build (`deps → build → runner`) with `output: "standalone"` for minimal image size. Development runs `next dev` with hot module replacement.

**Rendering:** The App Router (`src/app/`) colocates pages and API routes. Pages are client-side rendered (`"use client"`) for rich interactivity (WebSocket connections, real-time state updates). The root layout wraps all pages in a `ThemeProvider` (next-themes, dark mode by default) with shared `Navbar` and `Footer`.

**Pages:**

| Route | Purpose |
|-------|---------|
| `/` | Hero + `SearchForm` component — origin, destination, dates, cabin class, optional OpenAI key |
| `/history/[id]` | Real-time execution timeline — connects to browser-use WebSocket, streams agent steps + screenshots |
| `/results/[id]` | Flight results grid — loads from PostgreSQL, sortable by price/duration/time, filterable by direct-only |
| `/settings` | Service health dashboard — individual tests for Ollama, browser-use, PostgreSQL, pgvector |
| `/credits` | Usage guide, architecture overview, extensibility notes, and team roster |

**API Routes (14 endpoints under `/api/`):**

The API layer is the **bridge** between the browser and the backend services. Key flows:

- **`POST /api/search`** — The primary orchestrator. Validates the request with a Zod schema (`flightSearchParamsSchema`), queries PostgreSQL for cached results (skip if OpenAI key provided), creates `agent_ctx` + `agent_state` rows, then fires-and-forgets a `fetch()` to `http://browser-use:8000/search`. Returns immediately with `searchId` + `status: "running"`. The browser-use call uses `AbortSignal.timeout(15_000)` so slow accepts don't block the response. Errors on the fetch are caught asynchronously and mark the search as `failed` in the database.

- **`POST /api/callback/search-complete`** — The inbound callback from browser-use. Receives `{ search_id, status, results[], error }`. On success: inserts each flight into `flight_results` (with `raw_data` JSONB for audit), updates `agent_state` to `completed`, generates a vector embedding of a search summary via `generateEmbedding()`, and stores it in the `memory` table. On failure: updates `agent_state` to `failed` and stores a failure memory. Embedding generation is wrapped in try/catch — if Ollama is unavailable, the memory is stored without a vector.

- **`GET /api/results/[id]`** — Reads flight results + search params from PostgreSQL for display on the results page.

- **`GET /api/status/[id]`** — Polls `agent_state` from PostgreSQL. Used as fallback when the WebSocket connection fails.

- **`GET /api/system/status`** — Aggregates health of all 4 services into a single JSON response.

**Client-Side Patterns:**

- **`useFlightSearch` hook** (`SearchForm/hooks/`) — manages form submission, POST to `/api/search`, error state, and redirect to `/history/[id]` on success.

- **`useSearchExecution` hook** (`ExecutionTimeline/hooks/`) — connects a WebSocket to `ws://<host>:8000/ws/search/{id}` for live agent events. Features a dual-channel resilience pattern: WebSocket is the primary transport, HTTP polling (`GET /status/{id}`) is the automatic fallback when WS is unavailable or hasn't delivered data. Handles React StrictMode double-mount by tracking connection IDs (`wsIdRef`). Progress events are deduplicated between WS and polling via `polledProgressCountRef`.

- **Component structure** — directory-per-component with barrel exports:
  ```
  src/components/SearchForm/
  ├── index.ts              # Barrel export: export { SearchForm } from "./SearchForm"
  ├── SearchForm.tsx         # Component implementation
  ├── types.ts              # TypeScript interfaces
  └── hooks/
      └── useFlightSearch.ts # Custom hook
  ```

**Key Libraries:**

| Library | Usage |
|---------|-------|
| `ai` (v6) + `@ai-sdk/openai-compatible` (v2) | LLM streaming from Ollama via `createOpenAICompatible` |
| `@supabase/supabase-js` (v2) | Client-side database access |
| `drizzle-orm` (v0.45) | Server-side ORM with custom `vector(1536)` pgvector type |
| `zod` (v4) | Request/response validation schemas |
| `jotai` (v2.17) | Atomic state management (shared/global state) |
| `react-hook-form` (v7.71) + `@hookform/resolvers` (v5) | Form state with Zod resolver |
| `next-themes` (v0.4) | Dark/light mode + system detection |
| shadcn/ui + Radix UI | 11 composable UI primitives |

---

## Service Deep Dive — Browser-Use (Python FastAPI)

The browser-use service (in `browser-service/`) is the AI-powered browser automation agent. It navigates Kayak in a headless Chromium browser, extracts flight data, and returns structured results.

### How It Works

**Runtime:** Python 3.12-slim with system Chromium, managed by `uv` (not pip). The `app/` package follows a layered architecture with strict separation of concerns.

**Application Lifecycle:**

1. **Startup** — `app/main.py` creates the FastAPI app with a `lifespan` context manager. On startup, it calls `search_service.initialize()` to create an `asyncio.Semaphore` for concurrency control (default: 3 concurrent searches). Logging is configured once via `configure_logging()` before anything else.

2. **Configuration** — `app/config.py` uses `pydantic-settings` (`BaseSettings`) to load environment variables with type validation and defaults. A `@lru_cache` singleton ensures settings are loaded once.

3. **Request handling** — `POST /search` validates the `FlightSearchRequest`, checks the semaphore for capacity (returns 429 if full), registers the search in the in-memory `_active_searches` dict, and spawns a background `asyncio.create_task`.

### Layered Architecture

```
Routes (health.py, search.py, websocket.py)
  ↓ calls
Services (search.py, browser.py, callback.py)
  ↓ uses
Parsers (flight_parser.py, json_fixer.py, text_parser.py)
  ↓ references
Models (domain.py, requests.py, responses.py, enums.py)
  ↓ configured by
Config (config.py) + Constants (stealth.py, selectors.py)
```

### Search Execution Pipeline (`_run_search`)

The background task executes a 6-step pipeline:

| Step | Action | Detail |
|------|--------|--------|
| **0** | Init browser | Create stealth Chromium via CDP with anti-detection JS |
| **1** | Navigate | `page.goto()` to the constructed Kayak URL |
| **2** | Wait | 15-second delay for Kayak to render flight cards |
| **3** | Extract | Inject `EXTRACTION_JS` via `page.evaluate()` — scrapes `.nrc6-wrapper` flight card DOM |
| **4** | Parse | Feed raw extraction through JSON/text parsers |
| **5** | Complete | Mark search done, capture final screenshot |

Each step emits a `ProgressEvent` to the in-memory timeline. The WebSocket route polls this timeline and streams events to the frontend.

### Anti-Bot Stealth Layer

Kayak employs bot detection. The service counters this with:

- **CDP Script Injection** — `Page.addScriptToEvaluateOnNewDocument` injects stealth JS *before* any page load. This overrides `navigator.webdriver`, adds `window.chrome` runtime, spoofs plugins/languages arrays, and patches the Permissions API.
- **User-Agent Rotation** — 5 real browser UAs (Chrome/Firefox/Safari on Win/Mac/Linux), randomly selected per session.
- **Chromium Flags** — `--disable-blink-features=AutomationControlled`, `--no-first-run`, `--disable-infobars`.
- **Human-Like Delays** — Random 1–3 second pause before navigation to mimic human timing.
- **Shared Memory** — `shm_size: '2gb'` in Docker Compose prevents Chromium `/dev/shm` crashes.

### DOM Extraction (`EXTRACTION_JS`)

A JavaScript IIFE executed via `page.evaluate()` with a 3-tier fallback:

1. `.nrc6-wrapper` elements (Kayak's flight card containers)
2. `.nrc6-inner` elements (inner card structure)
3. `[aria-label*="Flight"]` elements (accessible fallback)

Each card's `innerText` is captured only if it contains both a `$` price and a `HH:MM` time pattern. At most 20 cards are extracted. If no cards are found, the fallback returns the first 15,000 characters of visible page text.

### Multi-Strategy Parser (`flight_parser.py`)

Applies 7 strategies in priority order to extract `FlightResult` objects:

| # | Strategy | Source |
|---|----------|--------|
| 0 | Structured output | Agent's `output_model_schema` → `FlightResultsOutput` |
| 1 | `final_result()` | Agent's final text output → JSON parse |
| 2 | `extracted_content` | All content extracted during agent steps |
| 3 | `action_results()` | Evaluate action return values |
| 4 | `model_actions` | LLM action parameters |
| 5 | `done` action text | Text from the agent's "done" action |
| 6 | Raw text objects | JavaScript evaluate output objects |

Each strategy feeds raw data into `try_parse_flight_json()` which attempts: direct JSON parse → malformed JSON repair (`fix_malformed_json`) → individual `{…}` block extraction. Key normalization (`_KEY_MAP`) handles 20+ variant key names (camelCase, snake_case, descriptive, abbreviated) emitted by different LLM models.

### Key Files

| File | Responsibility |
|------|---------------|
| `app/main.py` | FastAPI factory, CORS, lifespan, router registration |
| `app/config.py` | `Settings(BaseSettings)` — typed env vars with defaults |
| `app/logger.py` | `configure_logging()` + `get_logger()` (namespaced child loggers) |
| `app/services/search.py` | Search lifecycle: semaphore, `_active_searches` dict, `_run_search()` background task |
| `app/services/browser.py` | Stealth browser create/screenshot/close with CDP injection |
| `app/services/callback.py` | `notify_callback()` — POST results to Next.js via httpx |
| `app/parsers/flight_parser.py` | 7-strategy parser + key normalization |
| `app/parsers/json_fixer.py` | LLM JSON repair (smart quotes, trailing commas, unquoted keys) |
| `app/parsers/text_parser.py` | Heuristic regex parser for pipe-delimited Kayak card text |
| `app/constants/stealth.py` | 5 user agents + stealth JS for CDP injection |
| `app/constants/selectors.py` | `EXTRACTION_JS` — DOM scraping IIFE |
| `app/prompts/kayak.py` | `build_kayak_url()` + `build_flight_search_prompt()` |

---

## Service Deep Dive — Supabase DB (PostgreSQL + pgvector)

The database (in `supabase/`) uses the official `supabase/postgres:17.6.1.081` image which bundles PostgreSQL 17 with the pgvector extension. It serves as the persistent data store for all search operations and agent memory.

### How It Works

**Initialization:** On first boot, `supabase/init.sql` runs via Docker's `/docker-entrypoint-initdb.d/` mechanism. It enables the `vector` extension, creates the `postgres` role with grants, and defines 4 tables with indexes. This script only executes when the volume is empty (first start or after `make clean`).

**Persistence:** All data lives on the `supabase_data` Docker volume. Stops, restarts, and image rebuilds preserve all data. Only `make clean` (which runs `docker compose down -v`) destroys it.

### Schema

```sql
-- 4 tables, all using UUID primary keys with gen_random_uuid()

agent_ctx            -- Search parameters (immutable after creation)
├── id               UUID PK
├── origin           VARCHAR(10) — IATA code (e.g., "JFK")
├── destination      VARCHAR(10)
├── departure_date   DATE
├── return_date      DATE (nullable for one-way)
├── cabin_class      VARCHAR(20) DEFAULT 'economy'
├── direct_only      BOOLEAN DEFAULT FALSE
├── created_at       TIMESTAMPTZ
└── updated_at       TIMESTAMPTZ

agent_state          -- Execution lifecycle (1:1 with agent_ctx)
├── id               UUID PK
├── agent_ctx_id     UUID FK → agent_ctx (CASCADE)
├── status           VARCHAR(20) — CHECK: pending | running | completed | failed
├── error_message    TEXT (nullable)
├── started_at       TIMESTAMPTZ
├── completed_at     TIMESTAMPTZ
├── created_at       TIMESTAMPTZ
└── updated_at       TIMESTAMPTZ

flight_results       -- Extracted flights (1:N with agent_ctx)
├── id               UUID PK
├── agent_ctx_id     UUID FK → agent_ctx (CASCADE)
├── airline          VARCHAR(100)
├── departure_time   TIMESTAMPTZ
├── arrival_time     TIMESTAMPTZ
├── duration         VARCHAR(20) — e.g., "7h 30m"
├── stops            INTEGER DEFAULT 0
├── price            DECIMAL(10,2)
├── currency         VARCHAR(3) DEFAULT 'USD'
├── flight_url       TEXT
├── raw_data         JSONB — full agent output for audit
├── verified         BOOLEAN DEFAULT FALSE
├── verified_at      TIMESTAMPTZ
└── created_at       TIMESTAMPTZ

memory               -- Agent memory with vector embeddings (1:N with agent_ctx)
├── id               UUID PK
├── agent_ctx_id     UUID FK → agent_ctx (CASCADE)
├── content          TEXT — natural language search summary
├── embedding        vector(1536) — pgvector embedding from Ollama/nomic-embed-text
├── step_number      INTEGER
└── created_at       TIMESTAMPTZ
```

**Relationships:**

```
agent_ctx  ──1:1──▶  agent_state    (lifecycle tracking)
           ──1:N──▶  flight_results (extracted flight data)
           ──1:N──▶  memory         (search summaries + vector embeddings)
```

All foreign keys use `ON DELETE CASCADE` — deleting an `agent_ctx` row cascades to all related data.

### Indexes

| Index | Type | Purpose |
|-------|------|---------|
| `idx_agent_state_ctx_id` | B-tree | Join agent_state ↔ agent_ctx |
| `idx_agent_state_status` | B-tree | Filter by status (cache lookups) |
| `idx_memory_ctx_id` | B-tree | Join memory ↔ agent_ctx |
| `idx_flight_results_ctx_id` | B-tree | Join flight_results ↔ agent_ctx |
| `idx_memory_embedding` | IVFFlat (100 lists) | Cosine similarity search on vector(1536) |

### How Each Service Accesses the Database

| Service | Connection Method | Access Pattern |
|---------|------------------|----------------|
| **Next.js (API routes)** | `pg.Pool` → `DATABASE_URL` | Raw SQL via `client.query()` for writes (INSERT, UPDATE). Drizzle ORM schema exists for typed access but is not used for all queries yet. |
| **Next.js (client-side)** | `@supabase/supabase-js` | Available but minimally used (most access goes through API routes). |
| **browser-use** | None (indirect) | browser-use does NOT connect to PostgreSQL directly. It sends results to Next.js via HTTP callback (`POST /api/callback/search-complete`), which persists them. |

### Semantic Search (pgvector)

The `memory` table enables semantic similarity search across past search summaries:

1. When a search completes, Next.js generates a natural language summary (e.g., *"Flight search JFK → LHR on 2026-03-15 (economy): Found 8 results. Cheapest: Delta at $450 USD."*).
2. The summary is sent to Ollama's `/api/embeddings` endpoint with the `nomic-embed-text` model, returning a 1536-dim vector.
3. The summary + vector are stored in `memory.content` + `memory.embedding`.
4. The `GET /api/memory/search?q=...` endpoint performs cosine similarity search using the IVFFlat index.

---

## Inter-Service Communication

The four services communicate over the `aeroagent` Docker bridge network using service names as hostnames. There are no external dependencies and no service mesh — communication is direct HTTP/WebSocket.

### Communication Map

```
                    ┌──────────────────────────────────────────────────┐
                    │                    User Browser                  │
                    │           http://localhost:3000                  │
                    │         ws://localhost:8000/ws/...               │
                    └──────┬───────────────────────┬───────────────────┘
                           │                       │
            HTTP (pages, API)              WebSocket (direct)
                           │                       │
                    ┌──────▼───────┐        ┌──────▼───────┐
                    │    nextjs    │        │  browser-use │
                    │    :3000     │        │    :8000     │
                    └──┬───┬───┬───┘        └──┬───┬───────┘
                       │   │   │              │   │
            ┌──────────┘   │   └──────┐       │   └───────────────┐
            ▼              ▼          ▼       ▼                   ▼
     ┌────────────┐  ┌──────────┐  ┌─────────────┐         ┌───────────┐
     │ supabase-db│  │  ollama  │  │ browser-use │         │   ollama  │
     │   :5432    │  │  :11434  │  │   :8000     │         │  :11434   │
     └────────────┘  └──────────┘  └─────────────┘         └───────────┘
```

### Request Flows

**1. Search Initiation: User → Next.js → browser-use**

```
Browser                Next.js                  browser-use
  │                      │                          │
  │  POST /api/search    │                          │
  │─────────────────────▶│                          │
  │                      │  Validate (Zod)          │
  │                      │  Check cache (SQL)       │
  │                      │  INSERT agent_ctx        │
  │                      │  INSERT agent_state      │
  │                      │                          │
  │                      │  POST /search            │
  │                      │─────────────────────────▶│
  │                      │    (fire-and-forget)     │
  │                      │                          │
  │  { searchId, "running" }                        │
  │◀─────────────────────│                          │
  │                      │                          │
  │  redirect → /history/{id}                       │
```

**2. Live Progress: Browser ⇄ browser-use (WebSocket)**

```
Browser                                    browser-use
  │                                            │
  │  WS ws://<host>:8000/ws/search/{id}        │
  │───────────────────────────────────────────▶│
  │                                            │  Accept, send status
  │  ◀──── { type: "status" }                  │
  │                                            │  Background task runs:
  │                                            │  Step 0: Init browser
  │  ◀──── { type: "progress", step: 0, ... }  │
  │                                            │  Step 1: Navigate
  │  ◀──── { type: "progress", step: 1, ... }  │
  │                                            │  ...screenshots...
  │  ◀──── { type: "progress", step: 4, ... }  │
  │                                            │  Step 5: Done
  │  ◀──── { type: "done", results: [...] }    │
  │                                            │
```

The frontend also runs HTTP polling (`GET /status/{id}`) every 10 seconds as a fallback. If the WebSocket has delivered data, polling is skipped to avoid duplicates.

**3. Result Persistence: browser-use → Next.js → PostgreSQL**

```
browser-use                 Next.js                     PostgreSQL
  │                           │                             │
  │  POST /api/callback/      │                             │
  │  search-complete          │                             │
  │  { search_id,             │                             │
  │    status: "completed",   │                             │
  │    results: [...] }       │                             │
  │──────────────────────────▶│                             │
  │                           │  INSERT flight_results (N)  │
  │                           │────────────────────────────▶│
  │                           │                             │
  │                           │  UPDATE agent_state         │
  │                           │────────────────────────────▶│
  │                           │                             │
  │                           │  generateEmbedding()        │
  │                           │──▶ Ollama /api/embeddings   │
  │                           │                             │
  │                           │  INSERT memory (+vector)    │
  │                           │────────────────────────────▶│
  │                           │                             │
  │  ◀──── { ok: true }       │                             │
```

**4. AI Inference: Next.js / browser-use → Ollama**

```
Next.js (API routes)              Ollama
  │                                 │
  │  /api/ai/ollama-test            │
  │  streamText() via AI SDK        │
  │────────────────────────────────▶│  POST /v1/chat/completions
  │  ◀──── streaming response       │
  │                                 │
  │  /api/embeddings                │
  │  generateEmbedding()            │
  │────────────────────────────────▶│  POST /api/embeddings
  │  ◀──── { embedding: [...] }     │
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Fire-and-forget search dispatch** | The `POST /api/search` route does not `await` the browser-use response. It uses `fetch()` with a 15s abort signal. This keeps the user-facing response instant (<200ms). |
| **Callback pattern (not polling)** | browser-use actively POSTs results back to Next.js when done, rather than Next.js polling browser-use. This reduces unnecessary HTTP traffic and ensures data is persisted immediately. |
| **Direct WebSocket from browser** | The frontend connects directly to `browser-use:8000` for WebSocket (bypassing Next.js) to avoid Node.js becoming a bottleneck for binary screenshot data. |
| **browser-use has no DB access** | Keeps the Python service stateless and focused on browser automation. All persistence is Next.js's responsibility. |
| **In-memory search state** | `_active_searches` is a plain dict because the service is single-process and ephemeral. Searches are short-lived (~30-60s). No cross-restart durability needed — PostgreSQL provides that. |
| **Dual-channel resilience** | WebSocket is the primary transport for progress events. HTTP polling is the fallback. The client deduplicates events by tracking a shared counter. This handles network instability and React StrictMode gracefully. |

---

## How a Search Works (End-to-End)

```
1.  User fills SearchForm (origin, destination, dates, class)
    ├─ react-hook-form + Zod validation
    ├─ Optional: expands "Advanced Options" → pastes OpenAI API key
              │
2.  POST /api/search  ──▶  Validates with Zod (flightSearchParamsSchema)
              │              Checks cache (SQL query — skipped if OpenAI key provided)
              │              Creates agent_ctx + agent_state rows in PostgreSQL
              │              Fire-and-forget fetch to browser-use POST /search
              │              Returns { searchId, status: "running" }
              │              useFlightSearch hook redirects to /history/[id]
              │
3.  /history/[id] — useSearchExecution hook:
    ├─ Opens WebSocket to ws://<host>:8000/ws/search/{id}
    ├─ Starts HTTP polling fallback (every 10s, skipped when WS active)
    ├─ Deduplicates events via polledProgressCountRef
              │
4.  browser-use background task (_run_search):
    ├─ Step 0: Create stealth Chromium (CDP JS injection, random UA)
    ├─ Step 1: build_kayak_url() → page.goto()
    ├─ Step 2: Wait 15s for Kayak to render
    ├─ Step 3: page.evaluate(EXTRACTION_JS) → DOM scraping
    ├─ Step 4: _parse_extraction() → JSON parse / text parse
    ├─ Step 5: Complete — capture screenshot, mark done
    ├─ Each step emits ProgressEvent to in-memory timeline
    ├─ WebSocket route pushes events to connected clients
    └─ notify_callback() POSTs results to Next.js
              │
5.  Next.js callback (POST /api/callback/search-complete):
    ├─ Persists each flight result to flight_results (with raw_data JSONB)
    ├─ Generates vector embedding via Ollama (nomic-embed-text)
    ├─ Stores search summary + embedding in memory table
    └─ Updates agent_state to "completed"
              │
6.  History page detects completion:
    ├─ Shows collapsible Agent Output JSON
    ├─ Copy JSON button for clipboard export
    └─ "View Results" button → navigates to /results/[id]
              │
7.  /results/[id] — loads persisted data from PostgreSQL
    Flight cards rendered with sort (price/duration/time) and filter (direct only)
```

---

## Patterns & Standards

### Frontend Patterns

| Pattern | Implementation |
|---------|---------------|
| **Directory-per-component** | Each component gets its own folder with `index.ts` barrel export, `ComponentName.tsx`, `types.ts`, and optional `hooks/` |
| **Colocated hooks** | Custom hooks live next to the component that uses them (e.g., `SearchForm/hooks/useFlightSearch.ts`) |
| **Zod-first validation** | All API request/response shapes are defined as Zod schemas first, TypeScript types are inferred via `z.infer<>` |
| **Dark-first theming** | `next-themes` with `defaultTheme="dark"`, Tailwind CSS v4 `@custom-variant dark` |
| **shadcn/ui composability** | UI primitives are source-owned (in `components/ui/`), extended with `cn()` for conditional classes |
| **Atomic state** | Jotai atoms for cross-component shared state instead of React Context |
| **Fire-and-forget async** | Search dispatch doesn't block the UI response; status is tracked separately |
| **Graceful degradation** | Embedding generation failures don't break the callback — memory is stored without vector |

### Browser-Use Patterns

| Pattern | Implementation |
|---------|---------------|
| **Layered architecture** | `routes → services → parsers → models → config` with strict dependency direction |
| **Config-as-code** | `pydantic-settings` `BaseSettings` for typed, validated environment variables with `@lru_cache` singleton |
| **Lazy imports** | Heavy dependencies (`browser_use.Browser`) are imported inside functions, not at module level, to keep startup fast |
| **Structured logging** | `get_logger(name)` returns `browser-use.{name}` namespaced loggers with consistent format |
| **Semaphore-based rate limiting** | `asyncio.Semaphore` gates concurrent browser sessions (default 3) |
| **Module-level state** | `_active_searches` dict and `_semaphore` live at module level — valid because FastAPI is single-process |
| **Progressive parsing** | 7-strategy parser tries multiple extraction methods before giving up |
| **Key normalization** | `_KEY_MAP` handles 20+ variant key names that different LLMs emit |
| **CDP stealth injection** | `Page.addScriptToEvaluateOnNewDocument` runs before any navigation |
| **Background tasks** | `asyncio.create_task()` for non-blocking search execution |

### Database Patterns

| Pattern | Implementation |
|---------|---------------|
| **UUID primary keys** | `gen_random_uuid()` — no sequential IDs exposed |
| **CASCADE deletes** | All FKs use `ON DELETE CASCADE` for clean data lifecycle |
| **JSONB audit trail** | `raw_data` column stores the full agent output for debugging |
| **Status state machine** | CHECK constraint: `pending → running → completed | failed` |
| **Dual schema definition** | SQL in `init.sql` (runtime DDL) + Drizzle ORM in `schema.ts` (TypeScript type safety) |
| **IVFFlat vector index** | 100-list IVFFlat for fast approximate cosine similarity on embeddings |

### Code Quality Standards

| Standard | Enforcement |
|----------|------------|
| **PEP 8 / PEP 257** | Ruff linter (rules: E, F, I, W, UP, B, SIM) configured in `pyproject.toml` |
| **Python 3.12 target** | `target-version = "py312"`, line-length = 100 |
| **TypeScript strict** | `tsconfig.json` with strict mode enabled |
| **Type annotations** | All Python functions have return type hints; all TypeScript has explicit types |
| **Pydantic v2** | `BaseModel` with `Field(...)` for all API contracts |
| **`from __future__ import annotations`** | Every Python module uses deferred evaluation for forward references |

### Pre-Commit Hooks (Husky + lint-staged)

Every `git commit` triggers automated quality checks via Husky pre-commit hooks:

| Stage | What Runs | Scope |
|-------|-----------|-------|
| **lint-staged** | ESLint `--fix` (TS/TSX), Ruff `check --fix` + `format` (Python) | Staged files only |
| **Type check** | `tsc --noEmit` | Entire frontend project (if frontend files staged) |
| **Frontend tests** | `vitest run` | All frontend tests (if frontend files staged) |
| **Python tests** | `pytest tests/unit/` | Unit tests only (if browser-service files staged) |

**Setup:** `npm install` at repo root installs Husky + lint-staged. The `prepare` script auto-initializes the `.husky/` hooks.

**Manual full check:** `make quality` runs all quality gates without committing.

---

## Service Endpoints

### Next.js API Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | App health check |
| `POST` | `/api/search` | Start a flight search (validates, caches, dispatches) |
| `GET` | `/api/status/[id]` | Poll search status from PostgreSQL |
| `GET` | `/api/results/[id]` | Fetch flight results + search params |
| `GET` | `/api/verify/[id]` | Stub: result verification |
| `GET` | `/api/memory` | Store agent memory |
| `GET` | `/api/memory/search?q=...` | Semantic similarity search (pgvector) |
| `GET` | `/api/db/test-connection` | PostgreSQL connectivity test |
| `GET` | `/api/db/test-pgvector` | pgvector extension test |
| `GET` | `/api/ai/ollama-test` | Ollama streaming test |
| `GET` | `/api/browser-use/health` | Proxy to browser-use /health |
| `GET` | `/api/system/status` | Aggregate system health |
| `POST` | `/api/callback/search-complete` | Internal: browser-use → Next.js result persistence |

### Browser-Use Service

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health (returns `{"status": "ok"}`) |
| `POST` | `/search` | Start browser-based flight search (async background task) |
| `GET` | `/status/{search_id}` | In-memory search status with progress events |
| `WebSocket` | `/ws/search/{search_id}` | Real-time progress stream (screenshots, steps, completion) |

---

## Environment Variables

Defined in `.env.example` — copy to `.env` and adjust as needed:

| Variable | Default | Used By | Description |
|----------|---------|---------|-------------|
| `OLLAMA_HOST` | `http://ollama:11434` | nextjs, browser-use | Ollama URL (inside Docker) |
| `OLLAMA_MODEL` | `qwen3:8b` | browser-use | Default Ollama model for browser agent |
| `OPENAI_API_KEY` | (empty) | nextjs, browser-use | Optional OpenAI key (env-level fallback) |
| `BROWSER_USE_API_URL` | `http://browser-use:8000` | nextjs | Browser-use service URL |
| `DATABASE_URL` | `postgresql://postgres:postgres@supabase-db:5432/postgres` | nextjs | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | `postgres` | supabase-db | DB password |
| `POSTGRES_DB` | `postgres` | supabase-db | DB name |
| `NEXTJS_CALLBACK_URL` | `http://nextjs:3000/api/callback/search-complete` | browser-use | Callback endpoint for result delivery |
| `MAX_CONCURRENT_SEARCHES` | `3` | browser-use | Max parallel browser sessions |
| `CACHE_TTL_MINUTES` | `60` | nextjs | Flight result cache TTL |
| `SUPABASE_ANON_KEY` | `not-required-for-local` | nextjs | Unused for local setup |

---

## Docker Networking

All inter-service communication uses Docker service names on the `aeroagent` bridge network:

| From | To | URL | Protocol |
|------|----|-----|----------|
| Next.js | Ollama | `http://ollama:11434` | HTTP (AI SDK, embeddings) |
| Next.js | browser-use | `http://browser-use:8000` | HTTP (search dispatch) |
| Next.js | PostgreSQL | `supabase-db:5432` | TCP (pg Pool) |
| browser-use | Ollama | `http://ollama:11434` | HTTP (ChatOllama) |
| browser-use | Next.js | `http://nextjs:3000/api/callback/search-complete` | HTTP (result callback) |
| **Browser** | Next.js | `http://localhost:3000` | HTTP (pages, API) |
| **Browser** | browser-use | `ws://localhost:8000` | WebSocket (live progress) |

**From your host machine**, use `localhost` with mapped ports (3000, 8000, 5432, 11434).

---

## Health Checks

All services have Docker health checks configured for startup ordering:

| Service | Health Check | Interval | Startup Grace |
|---------|-------------|----------|---------------|
| **ollama** | `ollama list` | 10s | 30s |
| **browser-use** | `curl -f http://localhost:8000/health` | 10s | 20s |
| **supabase-db** | `pg_isready -U postgres` | 10s | 15s |
| **nextjs** | `curl -f http://localhost:3000/api/health` | 10s | 30s |

**Startup order** (via `depends_on` + `condition: service_healthy`):

```
ollama ──────────┐
                 ├──▶ browser-use ──┐
supabase-db ─────┘                  ├──▶ nextjs
supabase-db ────────────────────────┘
```

`ollama` and `supabase-db` start in parallel. `browser-use` waits for `ollama` to be healthy. `nextjs` waits for all three.

```bash
make dev-status    # All services should show (healthy)
```

The Settings page at http://localhost:3000/settings provides a visual dashboard to test each service connection individually.

---

## Debugging & Monitoring

### Container Status & Resources

```bash
# Overview of all containers (health, ports, uptime)
make dev-status

# One-line status with just names and health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Resource usage (CPU, memory, network I/O) — live dashboard
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# Check a specific container's details (mounts, env, health)
docker inspect browser-use-browser-use-1 | jq '.[0].State'
```

### Watching Logs

```bash
# All services (follow mode)
make dev-logs

# Individual service logs
make dev-frontend                # Next.js only
make dev-browser-use             # browser-use agent only

# Tail recent logs (last N lines)
docker logs browser-use-browser-use-1 --tail 50 2>&1
docker logs browser-use-nextjs-1 --tail 50 2>&1
docker logs browser-use-supabase-db-1 --tail 50 2>&1
docker logs browser-use-ollama-1 --tail 50 2>&1

# Follow logs from a specific time window
docker logs browser-use-browser-use-1 --since 5m -f 2>&1
```

### Debugging the Frontend (Next.js)

```bash
# Watch Next.js build/runtime errors
make dev-frontend

# Check API route responses from your terminal
curl -s http://localhost:3000/api/health | jq .
curl -s http://localhost:3000/api/system/status | jq .

# Test a specific API route with verbose output
curl -v http://localhost:3000/api/db/test-connection

# Check what environment variables the container sees
docker exec browser-use-nextjs-1 env | grep -E "OLLAMA|BROWSER|DATABASE"

# Run an interactive shell inside the Next.js container
make shell-frontend

# Check if node_modules are correctly installed
docker exec browser-use-nextjs-1 ls node_modules/.package-lock.json

# Inspect the standalone build (production only)
docker exec browser-use-nextjs-1 ls -la /app/.next/standalone/

# Check TypeScript compilation errors (dev mode)
docker logs browser-use-nextjs-1 2>&1 | grep -i "error\|warning\|TS[0-9]" | tail -20
```

### Debugging the Browser-Use Service (Python)

```bash
# Watch agent steps in real time (goals, URLs, evaluations)
docker logs browser-use-browser-use-1 -f 2>&1 | grep --line-buffered "Step\|goal\|Eval"

# Check if flight parsing succeeded or failed
docker logs browser-use-browser-use-1 2>&1 | grep -i "parsed\|No results\|Search completed"

# See which LLM model is being used
docker logs browser-use-browser-use-1 2>&1 | grep "LLM configured\|Running agent"

# Monitor active searches and their step progression
docker logs browser-use-browser-use-1 2>&1 | grep "Step [0-9]" | tail -30

# Check for agent errors or timeouts
docker logs browser-use-browser-use-1 2>&1 | grep -i "error\|timeout\|failed\|exception" | tail -20

# Verify the layered package structure imported correctly
docker exec browser-use-browser-use-1 python3 -c "from app.main import app; print(f'FastAPI v{app.version}')"

# Test the parser module in isolation
docker exec browser-use-browser-use-1 python3 -c "
from app.parsers.json_fixer import fix_malformed_json
print(fix_malformed_json('{\"airline\": \"Delta\",}'))
"

# Check the pydantic-settings configuration
docker exec browser-use-browser-use-1 python3 -c "
from app.config import get_settings
s = get_settings()
print(f'ollama_host={s.ollama_host}')
print(f'max_concurrent={s.max_concurrent_searches}')
print(f'openai_key_set={bool(s.openai_api_key)}')
"

# Verify stealth constants are loaded
docker exec browser-use-browser-use-1 python3 -c "
from app.constants.stealth import USER_AGENTS
print(f'{len(USER_AGENTS)} user agents loaded')
"

# Run a Python REPL inside the container for interactive debugging
make shell-browser-use
# then: python3
```

### Debugging the Database (PostgreSQL)

```bash
# Interactive psql shell
make shell-db

# One-shot queries (no interactive shell needed)
docker exec browser-use-supabase-db-1 psql -U postgres -c "\dt"

# Recent searches with status
docker exec browser-use-supabase-db-1 psql -U postgres -c "
  SELECT c.id::text, c.origin, c.destination, c.departure_date, s.status
  FROM agent_ctx c
  JOIN agent_state s ON s.agent_ctx_id = c.id
  ORDER BY c.created_at DESC LIMIT 10;
"

# Flight results for a specific search
docker exec browser-use-supabase-db-1 psql -U postgres -c "
  SELECT airline, departure_time, price, currency, stops
  FROM flight_results
  WHERE agent_ctx_id = 'SEARCH_ID'
  ORDER BY price ASC;
"

# Count flights per search (overview dashboard)
docker exec browser-use-supabase-db-1 psql -U postgres -c "
  SELECT c.origin || ' → ' || c.destination AS route,
         s.status,
         count(f.id) AS flights,
         min(f.price) AS cheapest
  FROM agent_ctx c
  JOIN agent_state s ON s.agent_ctx_id = c.id
  LEFT JOIN flight_results f ON f.agent_ctx_id = c.id
  GROUP BY c.id, c.origin, c.destination, s.status
  ORDER BY c.created_at DESC LIMIT 10;
"

# Check agent memory entries
docker exec browser-use-supabase-db-1 psql -U postgres -c "
  SELECT id, left(content, 80) AS summary, created_at
  FROM memory ORDER BY created_at DESC LIMIT 5;
"

# Table row counts
docker exec browser-use-supabase-db-1 psql -U postgres -c "
  SELECT relname AS table_name, n_live_tup AS row_count
  FROM pg_stat_user_tables ORDER BY n_live_tup DESC;
"

# Verify pgvector extension and version
docker exec browser-use-supabase-db-1 psql -U postgres -c \
  "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"

# Test vector similarity search manually
docker exec browser-use-supabase-db-1 psql -U postgres -c "
  SELECT id, left(content, 60), 1 - (embedding <=> (SELECT embedding FROM memory LIMIT 1)) AS similarity
  FROM memory
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> (SELECT embedding FROM memory LIMIT 1)
  LIMIT 5;
"

# Check index usage statistics
docker exec browser-use-supabase-db-1 psql -U postgres -c "
  SELECT indexrelname, idx_scan, idx_tup_read
  FROM pg_stat_user_indexes
  ORDER BY idx_scan DESC;
"

# Purge searches older than 7 days
docker exec browser-use-supabase-db-1 psql -U postgres -c "
  DELETE FROM flight_results WHERE agent_ctx_id IN (
    SELECT id FROM agent_ctx WHERE created_at < NOW() - INTERVAL '7 days');
  DELETE FROM memory WHERE agent_ctx_id IN (
    SELECT id FROM agent_ctx WHERE created_at < NOW() - INTERVAL '7 days');
  DELETE FROM agent_state WHERE agent_ctx_id IN (
    SELECT id FROM agent_ctx WHERE created_at < NOW() - INTERVAL '7 days');
  DELETE FROM agent_ctx WHERE created_at < NOW() - INTERVAL '7 days';
"
```

### WebSocket Debugging

```bash
# Test WebSocket connection to a running search (replace SEARCH_ID)
# Install: brew install websocat
websocat ws://localhost:8000/ws/search/SEARCH_ID

# Monitor WS connection events in browser-use logs
docker logs browser-use-browser-use-1 -f 2>&1 | grep --line-buffered "WebSocket\|ws/"

# Verify WS endpoint is reachable (HTTP upgrade handshake)
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: $(openssl rand -base64 16)" \
  http://localhost:8000/ws/search/test 2>&1 | head -10
```

### API Health Checks (from host)

```bash
# Aggregate system health (all services at once)
curl -s http://localhost:3000/api/system/status | jq .

# Individual service checks
curl -s http://localhost:8000/health                    # browser-use
curl -s http://localhost:3000/api/health                # Next.js
curl -s http://localhost:3000/api/browser-use/health    # browser-use via proxy
curl -s http://localhost:3000/api/db/test-connection    # PostgreSQL
curl -s http://localhost:3000/api/db/test-pgvector      # pgvector extension
curl -s http://localhost:3000/api/ai/ollama-test        # Ollama inference

# Ollama model list
curl -s http://localhost:11434/api/tags | jq '.models[].name'

# Quick Ollama inference test
curl -s http://localhost:11434/api/generate \
  -d '{"model":"qwen3:8b","prompt":"hi","stream":false}' | jq .response
```

### Restarting After Code Changes

```bash
# In dev mode — volume mounts auto-pick up code changes (no restart needed)
# Next.js: HMR picks up src/ changes instantly
# Python: uvicorn --reload watches for .py changes

# Restart services without rebuilding (if auto-reload isn't working)
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart browser-use
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart nextjs

# Full rebuild (after dependency changes to package.json or requirements.txt)
make dev-build

# Rebuild only one service
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build browser-use

# Force recreate (resets all container state)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --force-recreate browser-use
```

### Tracing a Specific Search

If a search isn't returning results, trace the full pipeline end-to-end:

```bash
SEARCH_ID="paste-search-id-here"

# 1. Was the search created in the database?
docker exec browser-use-supabase-db-1 psql -U postgres -c \
  "SELECT id, origin, destination, departure_date, cabin_class FROM agent_ctx WHERE id = '$SEARCH_ID';"

# 2. What's the agent state?
docker exec browser-use-supabase-db-1 psql -U postgres -c \
  "SELECT status, error_message, started_at, completed_at FROM agent_state WHERE agent_ctx_id = '$SEARCH_ID';"

# 3. What did the browser-use agent do? (search for the ID in logs)
docker logs browser-use-browser-use-1 2>&1 | grep "$SEARCH_ID" | tail -30

# 4. Did the callback fire? (check Next.js logs)
docker logs browser-use-nextjs-1 2>&1 | grep "$SEARCH_ID" | tail -10

# 5. Were results persisted?
docker exec browser-use-supabase-db-1 psql -U postgres -c \
  "SELECT airline, price, stops, currency FROM flight_results WHERE agent_ctx_id = '$SEARCH_ID';"

# 6. Was a memory entry created?
docker exec browser-use-supabase-db-1 psql -U postgres -c \
  "SELECT left(content, 100), embedding IS NOT NULL AS has_vector FROM memory WHERE agent_ctx_id = '$SEARCH_ID';"

# 7. What does the API return?
curl -s "http://localhost:3000/api/results/$SEARCH_ID" | jq '.results | length'
curl -s "http://localhost:3000/api/status/$SEARCH_ID" | jq .
```

---

## Troubleshooting

### Containers fail to start

```bash
make dev-logs                         # Check error output
docker compose logs <service-name>    # Single service logs
```

### Ollama: "model not found"

```bash
make pull-model    # Downloads qwen3:8b
```

### browser-use: Chromium crash or OOM

Ensure `shm_size: '2gb'` is set in `docker-compose.yml` (it is by default). If still crashing, increase Docker Desktop memory allocation to ≥16 GB.

### browser-use: Import errors after refactoring

The service uses a layered `app/` package. If you see `ModuleNotFoundError`, verify:

```bash
# Check the package structure is intact
docker exec browser-use-browser-use-1 find /app/app -name "*.py" | sort

# Test the import chain
docker exec browser-use-browser-use-1 python3 -c "from app.main import app; print('OK')"
```

### Next.js: build fails in dev mode

```bash
make dev-build     # Rebuild with fresh node_modules
```

### PostgreSQL: init.sql not applied

The init script only runs on first volume creation. To re-apply:

```bash
make clean         # ⚠️ Destroys all data
make dev           # Fresh start with init.sql
```

### HMR not working (file changes not reflected)

`WATCHPACK_POLLING=true` is set in `docker-compose.dev.yml` for filesystem polling. If still unresponsive:

```bash
make dev-down && make dev   # Restart dev containers
```

### macOS: GPU passthrough warning

The `deploy.resources.reservations.devices` block in `docker-compose.yml` is NVIDIA-specific. macOS ignores it gracefully — Ollama will use CPU inference (slower but functional).

### Port conflicts

If ports 3000, 8000, 5432, or 11434 are in use, stop conflicting services or change the port mappings in `docker-compose.yml`.

### Database connection from host tools (pgAdmin, DBeaver)

```
Host: localhost    Port: 5432
User: postgres     Password: postgres     Database: postgres
```

### Callback not reaching Next.js

If browser-use logs show "Callback failed" or "Connection refused":

```bash
# Verify Next.js is reachable from browser-use container
docker exec browser-use-browser-use-1 curl -s http://nextjs:3000/api/health

# Check the configured callback URL
docker exec browser-use-browser-use-1 python3 -c "
from app.config import get_settings
print(get_settings().nextjs_callback_url)
"
```

### WebSocket connection failing

The frontend connects directly to `browser-use:8000` (not through Next.js). Ensure:

```bash
# Port 8000 is mapped and accessible
curl -s http://localhost:8000/health

# WebSocket upgrade works
curl -i http://localhost:8000/ws/search/test \
  -H "Upgrade: websocket" -H "Connection: Upgrade" 2>&1 | head -5
```

---

## Testing

### Frontend Testing (Next.js)

The frontend has **100% test coverage** (statements, branches, functions, lines) with **55 test files** and **150+ test cases**.

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage
```

| Category | Files | What's Tested |
|----------|-------|---------------|
| **API Routes** | 14 test files | All 14 REST endpoints — request validation, database queries, error handling, edge cases |
| **Pages** | 5 test files | Home, Results, History, Settings, Layout — rendering, navigation, user interaction |
| **Components** | 14 test files | SearchForm, FlightCard, ExecutionTimeline, AgentStatus, Navbar, Footer, Settings panels |
| **UI Primitives** | 11 test files | All shadcn/ui components — Button, Badge, Card, Calendar, Form, Select, Tabs, etc. |
| **Hooks** | 6 test files | useFlightSearch, useSearchExecution (WebSocket + polling), health test hooks |
| **Libraries** | 5 test files | Zod schemas, embeddings, Ollama config, Supabase client, utilities |

**Stack:** Vitest + React Testing Library + @testing-library/user-event + jsdom + V8 coverage

See [`frontend/README.md`](frontend/README.md) for detailed testing documentation including mocking strategy, fixture usage, and how to write new tests.

---

## Project Status

All **85 / 85** original engineering tasks plus **Epic 7 (OpenAI & UX Enhancements)** with **11** additional tasks are `COMPLETED`. **Epic 9 (Browser-Service Testing)** is `COMPLETED`. **Epic 10 (Terminate Search)** is `COMPLETED`. **Epic 11 (Frontend Testing — 100% Coverage)** is `COMPLETED`. See [SPECS.md](SPECS.md) for full task tracking.

| Epic | Description | Status |
|------|-------------|--------|
| 1 | Local Docker Infrastructure | Done |
| 2 | Next.js Application Scaffold | Done |
| 3 | Flight Search Core | Done |
| 4 | Data Persistence & Agent Memory | Done |
| 5 | Settings & Observability | Done |
| 6 | Production Hardening (error handling, caching, verification) | Done |
| 7 | OpenAI Support & UX Enhancements | Done |
| 8 | Browser-Service Refactor & Parser Overhaul | Done |
| 9 | Browser-Service Testing (100% Coverage) | Done |
| 10 | Terminate Search | Done |
| 11 | Frontend Testing (100% Coverage) | Done |

---

## Application Sections

FlyWise (AeroAgent AI) ships with five pages, each accessible from the top navigation bar.

### Dashboard (`/`)

The landing page. A hero headline and the **SearchForm** component occupy center stage. Users fill in origin, destination, travel dates, passenger count, and cabin class. An **Advanced Options** expander reveals the optional OpenAI API key field. Clicking **Search Flights** triggers `POST /api/search`, which validates with Zod, checks the flight cache, creates database records, fires-and-forgets to browser-use, and returns a `searchId`. The `useFlightSearch` hook then redirects the browser to `/history/{searchId}` so the user can watch the search unfold in real time.

### Execution Timeline (`/history/[id]`)

A live, step-by-step visualization of the browser agent's work. The page's `useSearchExecution` hook opens a **WebSocket** directly to `ws://<host>:8000/ws/search/{id}` on the browser-use service. As the background task progresses through its pipeline — init browser → navigate Kayak → wait for render → DOM extraction → parse results → complete — each step emits a `ProgressEvent` that the WebSocket pushes to the client. The timeline UI renders each step with an icon, timestamp, description, and optional base64 screenshot.

A **dual-channel resilience** pattern keeps updates flowing even when WebSocket connectivity is unstable: HTTP polling (`GET /status/{id}`) runs every 10 seconds as an automatic fallback, and a shared counter (`polledProgressCountRef`) deduplicates events between the two channels. React StrictMode double-mount is handled via a connection-ID ref (`wsIdRef`).

When the search finishes, the timeline shows an **Agent Output** collapsible section with the raw JSON result (copyable to clipboard) and a **View Results** button that navigates to `/results/{id}`.

### Flight Results (`/results/[id]`)

Displays persisted flight data loaded from PostgreSQL via `GET /api/results/{id}`. Each flight is rendered as a **FlightCard** showing airline, departure/arrival times, duration, stop count, and price. The page provides three sort dimensions — **price**, **duration**, and **departure time** — each toggleable between ascending and descending. A **Direct flights only** switch filters out connections.

Two data-driven badges are computed independently of sort order: **Best Value** (purple — best price-to-duration ratio) and **Cheapest** (green — lowest absolute price). Badges are assigned via `useMemo` on the full result set, so they remain stable regardless of how the user sorts.

### Settings (`/settings`)

A service health dashboard. Four independent diagnostic panels test connectivity to each backend:

| Panel | What It Tests |
|-------|---------------|
| **Ollama** | `GET /api/ai/ollama-test` — sends a streaming prompt to `qwen3:8b` |
| **Browser-Use** | `GET /api/browser-use/health` — proxied health check |
| **PostgreSQL** | `GET /api/db/test-connection` — `SELECT NOW()` |
| **pgvector** | `GET /api/db/test-pgvector` — verifies the `vector` extension is installed |

Green checks = healthy. Red indicators + error messages help diagnose issues instantly.

### Credits (`/credits`)

Three sections that explain what FlyWise is and who built it:

1. **How to Use FlyWise** — guides users through Flight Search, Execution Timeline, History & Results, and Settings.
2. **About the Project** — describes the 100% local, privacy-first architecture: the 4-container stack, testing strategy, local SLM (Small Language Model) inference via Ollama, and extensibility beyond flights (food delivery, hotel comparison, form filling, etc.).
3. **Authors** — team roster:

| Name | Role |
|------|------|
| Ale Alfaro | Product Owner |
| Luis Martinez | UI/UX Designer |
| Kevin Martinez | Software Engineer |
| Jesús Sánchez | Software Engineer |
| Pablo Orozco | Tech Lead / Software Engineer |

---

## Spec-Driven Development

AeroAgent AI was built using a **spec-driven development** methodology. Every feature was documented as a user story with Gherkin acceptance criteria *before* implementation began. Three artifacts form the engineering backbone:

### CLAUDE.md — Project Instructions

[CLAUDE.md](CLAUDE.md) is the **root instruction file** that Claude Code (and any developer) reads before touching the codebase. It contains:

- Complete directory structure and file inventory
- All `make` targets with descriptions
- Docker networking rules (service names, ports, health checks)
- Frontend conventions (Next.js 16, Tailwind v4, shadcn/ui, AI SDK 6, Jotai, Zod)
- Browser-service conventions (layered architecture, pydantic-settings, lazy imports, stealth patterns)
- Database schema summary and connection strings
- Testing conventions (Vitest for frontend, pytest for Python, 100% coverage targets)
- Common gotchas (ChatOllama `host` parameter, no `playwright install`, Supabase is DB-only)

This file ensures that every contributor — human or AI — follows the same patterns from day one.

### SPECS.md — Engineering Specification

[SPECS.md](SPECS.md) is the **single source of truth** for what the application does. It documents:

- **11 epics** covering the full product scope
- Each epic contains numbered user stories with Gherkin-style acceptance criteria
- Every task has a status (`TODO` → `IN PROGRESS` → `COMPLETED`)
- Architecture decisions, data flow diagrams, and API contracts
- File inventories mapping each task to the exact files it created or modified

| Epic | Description | Status |
|------|-------------|--------|
| 1 | Local Docker Infrastructure | Completed |
| 2 | Next.js Application Scaffold | Completed |
| 3 | Flight Search Core | Completed |
| 4 | Data Persistence & Agent Memory | Completed |
| 5 | Settings & Observability | Completed |
| 6 | Production Hardening | Completed |
| 7 | OpenAI Support & UX Enhancements | Completed |
| 8 | Browser-Service Refactor & Parser Overhaul | Completed |
| 9 | Browser-Service Testing (100% Coverage) | Completed |
| 10 | Terminate Search | Completed |
| 11 | Frontend Testing (100% Coverage) | Completed |

The spec file was maintained incrementally — each task was marked `IN PROGRESS` before work began and `COMPLETED` immediately after verification. This gave the team continuous visibility into progress and prevented scope drift.

### .claude/skills/ — Reusable AI Engineering Skills

The `.claude/skills/` directory contains **12 skill definitions** that codify the project's patterns into reusable, AI-invocable instructions. Each skill is a directory with a `SKILL.md` file following the [Agent Skills](https://agentskills.io/) open standard.

| Skill | Purpose |
|-------|--------|
| `add-api-route` | Create a Next.js App Router API route following project conventions |
| `add-component` | Scaffold a React component (directory-per-component, Tailwind, Jotai) |
| `add-fastapi-endpoint` | Add a FastAPI endpoint to the browser-use service |
| `browser-use-patterns` | Reference: architecture, conventions, and code patterns for the Python service |
| `debug-container` | Diagnose Docker container issues (logs, health, connectivity) |
| `docker-dev` | Manage the Docker Compose dev environment (up/down/rebuild/status) |
| `env-config` | Environment variables, Docker networking, and connection strings |
| `frontend-patterns` | Reference: architecture, conventions, and code patterns for Next.js |
| `implement-task` | Pick next task from SPECS.md, implement it, track progress |
| `review-specs` | Audit SPECS.md accuracy against the live codebase |
| `supabase-schema` | Database schema, pgvector patterns, and SQL conventions |
| `test-browser-service` | Write and run pytest tests targeting 100% coverage |

Skills serve as **living documentation** — they encode the team's decisions about architecture, naming, file layout, and testing into instructions that any contributor (human or AI) can follow to produce consistent results. The conventions in [README-SKILLS.md](README-SKILLS.md) define the authoring standard: YAML frontmatter (`name`, `description`, `argument-hint`), clear directory layouts, and concrete code templates.

### How These Artifacts Work Together

```
CLAUDE.md                   SPECS.md                       .claude/skills/
(project rules)             (what to build)                (how to build it)
       │                          │                              │
       │  "Use Docker service      │  "US-3.2: Flight Search     │  skill: add-api-route
       │   names, not localhost"   │   Endpoint → Status:        │  → creates route.ts with
       │                          │   COMPLETED"                 │    correct imports, Zod,
       │                          │                              │    Docker URLs
       └──────────────────────────┴──────────────────────────────┘
                                  │
                          Consistent, spec-aligned code
```

1. A developer (or AI) reads **SPECS.md** to find the next task
2. They read **CLAUDE.md** to understand the project's constraints and conventions
3. They invoke the relevant **skill** (e.g., `add-api-route`, `add-component`) which scaffolds the implementation following all conventions automatically
4. They verify the work against the Gherkin acceptance criteria in SPECS.md
5. They mark the task `COMPLETED` in SPECS.md

This approach eliminated entire classes of errors — wrong import paths, inconsistent file structures, missing type annotations, incorrect Docker URLs — because the skills encode the right patterns directly.

---

## License

Private — All rights reserved.
