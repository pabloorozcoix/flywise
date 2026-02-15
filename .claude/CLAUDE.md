# AeroAgent AI — Project Instructions

See @README-PLAN.md for architecture and @SPECS.md for engineering specification with task tracking.

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
├── frontend/                  # Next.js 16 + TypeScript + Tailwind CSS v4
│   ├── Dockerfile             # Multi-stage production build (deps → build → runner)
│   ├── Dockerfile.dev         # Single-stage dev build (next dev + volume mounts)
│   ├── components.json        # shadcn/ui configuration
│   └── src/
│       ├── app/               # App Router pages and API routes
│       │   ├── layout.tsx     # Root layout with ThemeProvider (dark mode)
│       │   ├── page.tsx       # Home with SearchForm
│       │   ├── search/[id]/   # Live execution timeline
│       │   ├── results/[id]/  # Flight results display
│       │   ├── settings/      # Service connectivity tests
│       │   └── api/           # Route handlers
│       ├── components/
│       │   ├── ui/            # shadcn/ui components (button, input, form, card, etc.)
│       │   ├── theme-provider.tsx  # next-themes ThemeProvider wrapper
│       │   ├── theme-toggle.tsx    # Dark/light mode toggle button
│       │   └── ...            # App-specific components (SearchForm, FlightCard, etc.)
│       ├── lib/
│       │   ├── utils.ts       # cn() class merge utility (from shadcn init)
│       │   ├── localOllama.ts
│       │   └── supabase.ts
│       └── db/                # Drizzle ORM schema
├── browser-service/           # Python 3.12 FastAPI service
│   ├── Dockerfile             # Production build (python:3.12-slim + system Chromium + uv)
│   ├── Dockerfile.dev         # Dev build (uvicorn --reload + volume mount)
│   ├── main.py                # FastAPI app, /health, /search, /ws endpoints
│   ├── models.py              # Pydantic models (FlightSearchRequest/Response)
│   └── prompts.py             # Agent task prompt templates
├── supabase/
│   └── init.sql               # Schema: agent_ctx, agent_state, memory, flight_results + pgvector
├── docker-compose.yml         # Production Compose file
├── docker-compose.dev.yml     # Dev override (volume mounts + hot reload)
├── Makefile
├── .env.example
├── SPECS.md                   # Task tracking — update status here as tasks complete
└── README-PLAN.md             # Architecture reference
```

## Task Tracking Workflow

IMPORTANT: All task progress is tracked in `SPECS.md`. When implementing a task:
1. Update the task status from `TODO` to `IN PROGRESS` in SPECS.md
2. Implement the task
3. Update the task status to `COMPLETED` in SPECS.md
4. Respect the prerequisite dependencies listed in each task table

Execution order: Epic 1 → Epic 2 + Epic 5 (parallel) → Epic 3 → Epic 4 → Epic 6.

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
- Package management: `uv` (not pip directly in Docker)
- browser-use lib: use native imports — `from browser_use import Agent, Browser`
- LLM: use `ChatOllama` (native, NOT langchain) — `from browser_use import ChatOllama`
- ChatOllama config: `host="http://ollama:11434"` — parameter is `host`, NOT `base_url`
- Browser: `Browser(headless=True)` for Docker, uses system Chromium
- DO NOT run `playwright install` — system Chromium is already installed in the Dockerfile
- Chromium Docker deps: `chromium`, `fonts-liberation`, `libnss3`, `libxss1`, `libasound2`, `libatk-bridge2.0-0`, `libgtk-3-0`
- `shm_size: '2gb'` required in docker-compose for Chromium stability
- WebSocket endpoint at `/ws/search/{search_id}` for streaming progress events
- Agent config: `max_failures=3`, `final_response_after_failure=True`

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
