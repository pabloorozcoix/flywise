# AeroAgent AI — Project Instructions

See @README-PLAN.md for architecture, @SPECS.md for engineering specification, and @README-SKILLS.md for Claude Code skill authoring conventions.

## Project Overview

AeroAgent AI is a **100% local, Docker-based** flight search application. Four services orchestrated via Docker Compose:

1. **Next.js** (`frontend/`) — TypeScript frontend + API routes, port 3000
2. **Ollama** — Local LLM (`qwen3:8b`), port 11434
3. **browser-use** (`browser-service/`) — Python FastAPI wrapper around browser-use lib, port 8000
4. **PostgreSQL + pgvector** (`supabase/`) — Supabase Postgres image, port 5432

All services share the `aeroagent` Docker network. No cloud dependencies, no API keys.

## Commands

```bash
# ─── Production (full build) ───
docker compose up -d              # Start all services
docker compose down               # Stop all services (preserves volumes)
docker compose up -d --build      # Rebuild after code changes
docker compose logs -f            # View logs

# ─── Development (hot reload via volumes) ───
make dev                          # Start all services in dev mode (live reload)
make dev-down                     # Stop dev services
make dev-build                    # Rebuild dev containers (after adding deps)
make dev-logs                     # Follow all dev logs
make dev-frontend                 # Follow Next.js logs only
make dev-browser-use              # Follow browser-use logs only

# ─── Status check ───
make dev-status                   # Container health + status (dev mode)

# ─── Dependency management (inside containers) ───
make dev-install-frontend PKG="lodash"    # npm install inside nextjs container
make dev-install-python PKG="requests"    # uv pip install inside browser-use container

# ─── Interactive shells ───
make shell-frontend               # sh into Next.js container
make shell-browser-use            # bash into browser-use container
make shell-db                     # psql into PostgreSQL

# ─── Other ───
make pull-model                   # Pull qwen3:8b into Ollama (first time only)
make status                       # Container status and health
make clean                        # Remove all containers + volumes (WARNING: deletes data)

# Makefile shortcuts (production)
make up        # docker compose up -d
make down      # docker compose down
make logs      # docker compose logs -f
make build     # docker compose up -d --build

# ─── Testing (browser-use service) ───
make test-browser-use              # Run all browser-use tests
make test-browser-use-cov          # Run with coverage (enforces 100%)
make test-browser-use-unit         # Unit tests only
make test-browser-use-integration  # Integration tests only

# ─── Local Quality Gates (for pre-commit hooks — HOST) ───
make lint-frontend                 # ESLint check
make lint-fix-frontend             # ESLint auto-fix
make typecheck-frontend            # tsc --noEmit
make test-frontend                 # Vitest unit tests
make lint-python                   # Ruff check + format --check
make lint-fix-python               # Ruff auto-fix + format
make test-python-local             # pytest unit tests (local)
make quality                       # Run ALL quality checks at once
```

## Development Workflow

For day-to-day development, use `make dev` instead of `make up`. This:
- Mounts `frontend/src/`, `frontend/public/`, and config files as volumes into the Next.js container
- Mounts `browser-service/` as a volume into the browser-use container
- Runs `next dev` (HMR) instead of the production `node server.js`
- Runs `uvicorn --reload` instead of the production `uvicorn` for live Python reloading
- Uses `Dockerfile.dev` (single-stage, no multi-stage build) for both services

After adding a new npm or pip dependency, run `make dev-build` to rebuild containers with the new lockfile.

### File Layout for Dev Volumes

```
docker-compose.dev.yml            # Development override (volume mounts + dev commands)
frontend/Dockerfile.dev           # Single-stage dev Dockerfile (next dev)
browser-service/Dockerfile.dev    # Dev Dockerfile (uvicorn --reload)
```

## Directory Structure

```
/
├── frontend/                      # Next.js 16 + TypeScript + Tailwind CSS v4
│   ├── Dockerfile                 # Multi-stage production build (deps → build → runner)
│   ├── Dockerfile.dev             # Single-stage dev build (next dev + volume mounts)
│   ├── components.json            # shadcn/ui configuration
│   └── src/
│       ├── app/                   # App Router pages and API routes
│       │   ├── layout.tsx         # Root layout with ThemeProvider (dark mode)
│       │   ├── page.tsx           # Home with SearchForm
│       │   ├── history/[id]/      # Live execution timeline (WebSocket)
│       │   ├── results/[id]/      # Flight results display (sort/filter)
│       │   ├── settings/          # Service connectivity tests
│       │   └── api/               # 15 REST + streaming route handlers
│       ├── components/
│       │   ├── ui/                # shadcn/ui components (11 primitives)
│       │   ├── SearchForm/        # Flight search form + useFlightSearch hook
│       │   ├── FlightCard/        # Flight result card
│       │   ├── ExecutionTimeline/ # Real-time agent progress + useSearchExecution hook
│       │   ├── AgentStatus/       # Status badge
│       │   ├── Navbar/            # App navigation
│       │   ├── Footer/            # App footer
│       │   └── settings/          # Health test components
│       ├── lib/
│       │   ├── utils.ts           # cn() class merge utility (from shadcn init)
│       │   ├── localOllama.ts     # AI SDK createOpenAICompatible provider
│       │   ├── supabase.ts        # Supabase client + DATABASE_URL export
│       │   ├── embeddings.ts      # Ollama-powered vector embedding generation
│       │   ├── schemas/           # Zod validation schemas
│       │   └── types/             # TypeScript type definitions
│       └── db/
│           └── schema.ts          # Drizzle ORM schema (pgvector custom type)
├── browser-service/               # Python 3.12 FastAPI service (layered architecture)
│   ├── Dockerfile                 # Production build (python:3.12-slim + Chromium + uv)
│   ├── Dockerfile.dev             # Dev build (uvicorn --reload + volume mount)
│   ├── pyproject.toml             # Project metadata + ruff + pytest config
│   ├── requirements.txt           # Pinned dependencies
│   ├── requirements-test.txt      # Test dependencies (pytest, pytest-asyncio, pytest-cov, respx)
│   ├── app/                       # Python package (layered)
│   │   ├── main.py                # FastAPI app factory (lifespan, CORS, router)
│   │   ├── config.py              # pydantic-settings Settings class
│   │   ├── logger.py              # Structured logging (configure_logging + get_logger)
│   │   ├── models/                # Pydantic domain models (enums, domain, requests, responses)
│   │   ├── constants/             # Static config (stealth.py, selectors.py)
│   │   ├── prompts/               # Agent prompt templates (kayak.py, extraction.py)
│   │   ├── parsers/               # Multi-strategy result extraction (7-strategy parser)
│   │   ├── services/              # Business logic (browser, callback, search)
│   │   └── routes/                # FastAPI endpoint handlers (health, search, websocket)
│   └── tests/                     # pytest test suite (100% coverage target)
│       ├── conftest.py            # Shared fixtures (client, mocks, state reset)
│       ├── unit/                  # Unit tests (11 files — models, parsers, prompts, config)
│       └── integration/           # Integration tests (6 files — routes, services)
├── supabase/
│   └── init.sql                   # DDL: pgvector extension, 4 tables, indexes, grants
├── .claude/
│   └── skills/                    # Claude Code skills (11 skills)
├── docker-compose.yml             # Production Compose file (4 services, aeroagent network)
├── docker-compose.dev.yml         # Dev override (volume mounts + hot reload)
├── package.json                   # Root: Husky + lint-staged (dev tooling only)
├── Makefile                       # 30 convenience targets
├── .env.example
├── README-SKILLS.md               # Canonical reference for Claude Code skill authoring
├── SPECS.md                       # Engineering spec — 9 epics (8 COMPLETED + Epic 9 testing IN PROGRESS)
└── README-PLAN.md                 # Architecture reference
```

## Task Tracking Workflow

Epics 1–8 (114 tasks) are COMPLETED. Epic 9 (browser-service testing) is COMPLETED. Epic 10 (terminate search) is COMPLETED.

Execution order was: Epic 1 → Epic 2 + Epic 5 (parallel) → Epic 3 → Epic 4 → Epic 6 → Epic 7 → Epic 8 → Epic 9 → Epic 10.

## Frontend (TypeScript)

- **Next.js 16** with App Router — all pages under `src/app/`
- **TypeScript strict mode** enabled
- **Tailwind CSS v4** for styling — CSS-first configuration (no `tailwind.config.ts` needed)
- **shadcn/ui** for UI components — uses Radix UI primitives + Tailwind CSS
  - Initialize with `npx shadcn@latest init` (select "new-york" style, CSS variables: yes) — automatically configures Tailwind v4
  - Dark mode: use `next-themes` with `<ThemeProvider attribute="class" defaultTheme="dark">` in root layout
  - Dark mode CSS (Tailwind v4): `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css` (replaces `darkMode: "class"` in old `tailwind.config.ts`)
  - CSS entry: `@import "tailwindcss"` and `@import "tw-animate-css"` in `globals.css` (replaces `@tailwind base/components/utilities`)
  - Form components: use `shadcn/ui` `<Form>`, `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>` — built on `react-hook-form` + `zod` via `@hookform/resolvers/zod`
  - Add components as needed: `npx shadcn@latest add button input select form label card tabs badge popover calendar date-picker switch`
  - Components are installed to `src/components/ui/` — these are owned source files, not node_modules
  - Use `cn()` utility from `src/lib/utils.ts` for conditional class merging (installed by shadcn init)
- AI SDK 6: use `ai` and `@ai-sdk/openai-compatible` (v2), NOT older `ai/rsc` patterns
- Ollama provider: `createOpenAICompatible()` from `@ai-sdk/openai-compatible`, NOT `createOpenAI`
- Streaming: use `streamText()` from `ai` package, return via `result.toTextStreamResponse()`
- Database: Drizzle ORM with `drizzle-orm/pg-core`, NOT raw SQL from Next.js
- Supabase client: `@supabase/supabase-js` for client-side, Drizzle for server-side
- Validation: Zod schemas for all request/response types
- State management: Jotai atoms for shared/global state — no React Context for state, no prop drilling
- Component structure: directory-per-component with `index.ts`, types, hooks, constants, styles, atoms
- Key deps: `ai@^6`, `@ai-sdk/openai-compatible@^2`, `@supabase/supabase-js@^2`, `drizzle-orm@^0.45`, `zod@^4`, `jotai@^2.17`, `next-themes@^0.4`, `react-hook-form@^7.71`, `@hookform/resolvers@^5`
- shadcn/ui deps (auto-installed by `npx shadcn@latest init`): `tw-animate-css`, `class-variance-authority@^0.7`, `clsx@^2`, `tailwind-merge@^3`, `lucide-react@^0.563`, `@radix-ui/*`

## Browser Service (Python)

- **Python 3.12** with FastAPI + uvicorn
- **Layered architecture**: `app/routes/ → services/ → parsers/ → models/ → config`
- Package management: `uv` (not pip directly in Docker)
- App factory pattern: `app/main.py` creates FastAPI app with lifespan, CORS, router registration
- Config: `pydantic-settings` `BaseSettings` in `app/config.py` with `@lru_cache` singleton
- Logging: `app/logger.py` — `configure_logging()` + `get_logger(name)` for namespaced child loggers
- browser-use lib: use native imports — `from browser_use import Agent, Browser`
- LLM: use `ChatOllama` (native, NOT langchain) — `from browser_use import ChatOllama`
- ChatOllama config: `host="http://ollama:11434"` — parameter is `host`, NOT `base_url`
- Browser: `Browser(headless=True)` for Docker, uses system Chromium
- DO NOT run `playwright install` — system Chromium is already installed in the Dockerfile
- Chromium Docker deps: `chromium`, `fonts-liberation`, `libnss3`, `libxss1`, `libasound2`, `libatk-bridge2.0-0`, `libgtk-3-0`
- `shm_size: '2gb'` required in docker-compose for Chromium stability
- WebSocket endpoint at `/ws/search/{search_id}` for streaming progress events
- Agent config: `max_failures=3`, `final_response_after_failure=True`
- All Python files use `from __future__ import annotations` for deferred evaluation
- Type annotations required on all functions (params + return)
- Imports: absolute within package (`from app.models.domain import FlightResult`)
- Heavy deps imported lazily inside functions (e.g., `browser_use.Browser`)

## Browser Service Testing

- **pytest** with `pytest-asyncio` (asyncio_mode = "auto" in `pyproject.toml`)
- Test deps in `requirements-test.txt` (pytest, pytest-asyncio, pytest-cov, respx)
- Test structure: `browser-service/tests/unit/` and `browser-service/tests/integration/`
- Coverage target: **100%** via `--cov=app --cov-report=term-missing --cov-fail-under=100`
- Use `monkeypatch.setenv` for config overrides; `clear_settings_cache` autouse fixture clears `@lru_cache`
- Mock `browser_use.Browser` via `unittest.mock.patch` (lazy import pattern)
- HTTP mocking: `respx` for httpx-based callback tests
- WebSocket testing: `starlette.testclient.TestClient` (sync, not async)
- Route testing: `httpx.AsyncClient` with `ASGITransport(app=app)`
- Module-level state (`_active_searches`, `_semaphore`) reset via autouse fixtures

## Database

- Image: `supabase/postgres:17.6.0.038` (includes pgvector)
- Enable pgvector: `CREATE EXTENSION IF NOT EXISTS vector;` in init.sql
- Embeddings column: `vector(1536)` type
- Tables: `agent_ctx`, `agent_state`, `memory` (with vector embeddings), `flight_results`
- Connection from Next.js: `postgresql://postgres:postgres@supabase-db:5432/postgres` (inside Docker)
- Connection from host: `postgresql://postgres:postgres@127.0.0.1:5432/postgres`
- Volume: `supabase_data` for persistence across restarts

## Docker Networking

- All inter-service communication uses Docker service names, NOT localhost:
  - Next.js → Ollama: `http://ollama:11434`
  - Next.js → browser-use: `http://browser-use:8000`
  - Next.js → PostgreSQL: `supabase-db:5432`
  - browser-use → Ollama: `http://ollama:11434`
- Host access uses `localhost` with mapped ports (3000, 11434, 8000, 5432)
- GPU passthrough for Ollama is optional (NVIDIA only, via `deploy.resources.reservations`)

## Health Checks

- Ollama: `GET /api/tags` (NOT `/health`)
- browser-use: `GET /health` → `{"status": "ok"}`
- PostgreSQL: `pg_isready -U postgres`
- Next.js: `GET /api/health`
- Use `depends_on` with `condition: service_healthy` for startup ordering

## Environment Variables

```bash
# Ollama
OLLAMA_HOST=http://ollama:11434          # Inside Docker
# OLLAMA_HOST=http://localhost:11434     # From host

# Browser-Use
BROWSER_USE_API_URL=http://browser-use:8000

# Database
DATABASE_URL=postgresql://postgres:postgres@supabase-db:5432/postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres

# Cache
CACHE_TTL_MINUTES=60                     # Flight result cache TTL
```

## Common Gotchas

- browser-use has NO built-in HTTP server — the FastAPI wrapper in `browser-service/` is custom
- browser-use uses `ChatOllama` natively (via `ollama` SDK), NOT langchain's ChatOllama
- The `ollama/ollama:latest` image does NOT include any models — must `ollama pull` after first start
- Supabase Postgres image is database-only — no Auth/Storage/Realtime/Studio services
- Google Flights may trigger anti-bot detection — use stealth settings, random delays, user-agent rotation
- Browser automation takes 30-60s typically — always use WebSocket streaming for UX
- On macOS, GPU passthrough for Ollama is not available (NVIDIA-only feature)
