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
- [Service Endpoints](#service-endpoints)
- [Environment Variables](#environment-variables)
- [Docker Networking](#docker-networking)
- [Database Schema](#database-schema)
- [How a Search Works (End-to-End)](#how-a-search-works-end-to-end)
- [Health Checks](#health-checks)
- [Debugging & Monitoring](#debugging--monitoring)
- [Troubleshooting](#troubleshooting)
- [Project Status](#project-status)
- [License](#license)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Docker Compose  ·  aeroagent network          │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              nextjs  ·  localhost:3000                        │   │
│  │  React UI (search form,     │  API Routes (TypeScript)       │   │
│  │  execution timeline,        │  POST /api/search              │   │
│  │  flight results)            │  GET  /api/results/[id]        │   │
│  │  AI SDK 6 + shadcn/ui       │  WS   proxy → browser-use     │   │
│  └──────────────────────────────┴───────────────────────────────┘   │
│                │                    │                    │           │
│       ┌────────┘          ┌────────┘          ┌────────┘           │
│       ▼                   ▼                   ▼                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐      │
│  │  ollama      │  │  browser-use │  │  supabase-db         │      │
│  │  :11434      │  │  :8000       │  │  :5432               │      │
│  ├──────────────┤  ├──────────────┤  ├──────────────────────┤      │
│  │ gpt-oss:20b  │  │ FastAPI      │  │ PostgreSQL 17        │      │
│  │ OpenAI-compat│  │ browser-use  │  │ pgvector (1536-dim)  │      │
│  │ local infer. │  │ Chromium     │  │ Drizzle ORM schema   │      │
│  └──────────────┘  │ ChatOllama   │  └──────────────────────┘      │
│         ▲           │ or ChatOpenAI│                                │
│         │           └──────────────┘                                │
│         │                  │                                        │
│  ┌──────┴──────┐           │ (optional)                             │
│  │  OpenAI API │◀──────────┘                                        │
│  │  (optional) │  User-provided API key                             │
│  │  gpt-4.1-*  │  for faster extraction                            │
│  └─────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Data flow:** User submits a search → Next.js API route persists params to PostgreSQL, calls browser-use service → browser-use agent (driven by Ollama or OpenAI) opens Chromium, navigates Kayak, extracts results → results are persisted to PostgreSQL and displayed in real time via WebSocket → on completion, a structured JSON output with search params and flights is shown.

---

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui | UI, API routes, SSR |
| **State** | Jotai, react-hook-form + Zod v4 | Client state, form validation |
| **AI (TS)** | AI SDK 6, `@ai-sdk/openai-compatible` v2 | LLM streaming from Ollama |
| **AI (Python)** | browser-use ≥0.11.9, FastAPI, `ChatOllama` / `ChatOpenAI` (native) | Browser automation agent |
| **LLM** | Ollama (gpt-oss:20b) — default · OpenAI (gpt-4.1-mini) — optional | Local or cloud inference |
| **Database** | PostgreSQL 17 + pgvector | Search persistence, vector embeddings |
| **Infra** | Docker Compose, Makefile | Container orchestration |

---

## Repository Layout

```
.
├── frontend/                      # Next.js 16 application
│   ├── Dockerfile                 #   Production multi-stage build
│   ├── Dockerfile.dev             #   Dev single-stage (next dev + HMR)
│   ├── package.json
│   ├── next.config.ts             #   output: "standalone"
│   └── src/
│       ├── app/                   #   App Router pages + API routes
│       │   ├── page.tsx           #     Home — SearchForm
│       │   ├── search/[id]/       #     Live execution timeline
│       │   ├── results/[id]/      #     Flight results grid
│       │   ├── settings/          #     Service connectivity tests
│       │   └── api/               #     REST + streaming routes
│       ├── components/            #   UI components (directory-per-component)
│       │   ├── ui/                #     shadcn/ui primitives
│       │   ├── SearchForm/
│       │   ├── FlightCard/
│       │   ├── ExecutionTimeline/
│       │   ├── AgentStatus/
│       │   └── settings/
│       ├── db/
│       │   └── schema.ts          #   Drizzle ORM schema
│       └── lib/
│           ├── localOllama.ts     #   AI SDK Ollama provider
│           ├── supabase.ts        #   Supabase client
│           ├── embeddings.ts      #   Vector embedding generation
│           └── utils.ts           #   cn() class merge utility
│
├── browser-service/               # Python 3.12 FastAPI service
│   ├── Dockerfile                 #   Production build
│   ├── Dockerfile.dev             #   Dev build (uvicorn --reload)
│   ├── main.py                    #   FastAPI app, /health, POST /search, WS /ws/search/{id}
│   ├── models.py                  #   Pydantic models
│   ├── prompts.py                 #   Agent task prompt templates
│   └── requirements.txt
│
├── supabase/
│   └── init.sql                   # DDL: agent_ctx, agent_state, memory, flight_results + pgvector
│
├── docker-compose.yml             # Production Compose (4 services)
├── docker-compose.dev.yml         # Dev override (volume mounts + hot reload)
├── Makefile                       # Convenience targets
├── .env.example                   # Environment variable template
├── SPECS.md                       # Engineering spec with task tracking
│
└── .claude/                       # AI agent instructions
    ├── CLAUDE.md                  #   Project conventions & gotchas
    ├── README-PLAN.md             #   Architecture reference
    └── skills/                    #   Reusable task skills
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

> **No Node.js or Python installation required on your host.** Everything runs inside containers.

---

## Quick Start — First Time Setup

Follow these steps **once** to get AeroAgent AI running from scratch.

### 1. Clone & Configure

```bash
git clone <repository-url> aeroagent-ai
cd aeroagent-ai

# Copy environment template (defaults work out of the box)
cp .env.example .env
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
make pull-model    # docker compose exec ollama ollama pull gpt-oss:20b
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
| **Python** | `uvicorn main:app` | `uvicorn main:app --reload` |
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
| `make pull-model` | Pull `gpt-oss:20b` model |
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

---

## Development Workflow

### Frontend (Next.js)

```bash
make dev             # Start dev environment
make dev-frontend    # Watch Next.js logs
```

Edit any file under `frontend/src/` — Next.js HMR picks up changes instantly in the browser.

**Key directories:**

- `src/app/` — Pages and API routes (App Router)
- `src/components/` — React components (directory-per-component pattern)
- `src/lib/` — Shared utilities (Ollama provider, Supabase client, embeddings)
- `src/db/schema.ts` — Drizzle ORM schema

**Component convention:** Each component lives in its own directory:

```
src/components/SearchForm/
├── index.ts              # Barrel export
├── SearchForm.tsx        # Implementation
├── types.ts              # TypeScript interfaces
└── hooks/
    └── useFlightSearch.ts
```

### Browser Service (Python)

```bash
make dev              # Start dev environment
make dev-browser-use  # Watch Python logs
```

Edit any `.py` file under `browser-service/` — uvicorn's `--reload` picks up changes automatically.

**Key files:**

- `main.py` — FastAPI app with `/health`, `POST /search`, `WebSocket /ws/search/{id}`
- `models.py` — Pydantic request/response models
- `prompts.py` — Agent task prompt templates for Kayak navigation

**Important:** browser-use uses its **native** LLM adapters (not langchain). Import as:

```python
# Ollama (default — local, no API key)
from browser_use import Agent, Browser, ChatOllama
llm = ChatOllama(model="gpt-oss:20b", host="http://ollama:11434")

# OpenAI (optional — requires user-provided API key)
from browser_use.llm.openai.chat import ChatOpenAI
llm = ChatOpenAI(model="gpt-4.1-mini", api_key="sk-...")
```

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

## Service Endpoints

### Next.js API Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | App health check |
| `POST` | `/api/search` | Start a flight search |
| `GET` | `/api/status/[id]` | Poll search status |
| `GET` | `/api/results/[id]` | Fetch flight results |
| `GET` | `/api/verify/[id]` | Stub: result verification |
| `GET` | `/api/memory` | Store agent memory |
| `GET` | `/api/memory/search?q=...` | Semantic similarity search |
| `GET` | `/api/db/test-connection` | PostgreSQL connectivity test |
| `GET` | `/api/db/test-pgvector` | pgvector extension test |
| `GET` | `/api/ai/ollama-test` | Ollama streaming test |
| `GET` | `/api/browser-use/health` | Proxy to browser-use /health |
| `GET` | `/api/system/status` | Aggregate system health |
| `POST` | `/api/callback/search-complete` | Internal: browser-use → Next.js callback |

### Browser-Use Service

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health |
| `POST` | `/search` | Start browser-based flight search |
| `WebSocket` | `/ws/search/{search_id}` | Real-time progress stream |

---

## Environment Variables

Defined in `.env.example` — copy to `.env` and adjust as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | `http://ollama:11434` | Ollama URL (inside Docker) |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Default Ollama model for inference |
| `BROWSER_USE_API_URL` | `http://browser-use:8000` | Browser-use service URL |
| `DATABASE_URL` | `postgresql://postgres:postgres@supabase-db:5432/postgres` | PostgreSQL connection |
| `POSTGRES_PASSWORD` | `postgres` | DB password |
| `POSTGRES_DB` | `postgres` | DB name |
| `SUPABASE_ANON_KEY` | `not-required-for-local` | Unused for local setup |
| `CACHE_TTL_MINUTES` | `60` | Flight result cache TTL |
| `MAX_CONCURRENT_SEARCHES` | `3` | Rate limit: concurrent browser agents |

---

## Docker Networking

All inter-service communication uses Docker service names on the `aeroagent` bridge network:

| From | To | URL |
|------|----|-----|
| Next.js | Ollama | `http://ollama:11434` |
| Next.js | browser-use | `http://browser-use:8000` |
| Next.js | PostgreSQL | `postgresql://postgres:postgres@supabase-db:5432/postgres` |
| browser-use | Ollama | `http://ollama:11434` |
| browser-use | Next.js (callback) | `http://nextjs:3000/api/callback/search-complete` |

**From your host machine**, use `localhost` with mapped ports (3000, 8000, 5432, 11434).

---

## Database Schema

Four tables managed by `supabase/init.sql` and `frontend/src/db/schema.ts` (Drizzle ORM):

| Table | Purpose |
|-------|---------|
| `agent_ctx` | Search parameters (origin, destination, dates, cabin class) |
| `agent_state` | Execution status per search (`pending` → `running` → `completed`/`failed`) |
| `flight_results` | Extracted flights (airline, times, price, stops, verification status) |
| `memory` | Agent reasoning steps + 1536-dim vector embeddings for semantic search |

```
agent_ctx  ──1:N──▶  agent_state
           ──1:N──▶  flight_results
           ──1:N──▶  memory (with vector embedding)
```

---

## How a Search Works (End-to-End)

```
1.  User fills SearchForm (origin, destination, dates, class)
    ├─ Optional: expands "Advanced Options" → pastes OpenAI API key
              │
2.  POST /api/search  ──▶  Validates with Zod schema
              │              Checks cache (skipped if OpenAI key provided)
              │              Creates agent_ctx + agent_state rows in PostgreSQL
              │              Sends request to browser-use service
              │              Returns search_id → redirect to /search/[id]
              │
3.  /search/[id] page opens WebSocket to browser-use /ws/search/{id}
              │
4.  browser-use agent:
    ├─ Selects LLM: ChatOpenAI (if API key given) or ChatOllama (default)
    ├─ Opens Chromium (headless, stealth settings)
    ├─ Navigates to Kayak
    ├─ Dismisses popups/modals
    ├─ Extracts flight results as structured JSON (max 20 agent steps)
    ├─ Streams progress events + screenshots via WebSocket
    └─ Calls POST /api/callback/search-complete with results
              │
5.  Next.js callback:
    ├─ Persists each flight result to flight_results table (with raw_data JSONB)
    ├─ Stores agent step summary + embedding in memory table
    └─ Updates agent_state to "completed"
              │
6.  Search page shows:
    ├─ Collapsible Agent Output JSON: { search: {...}, flights: [...] }
    ├─ Copy JSON button for clipboard export
    └─ "View Results" button → navigates to /results/[id]
              │
7.  /results/[id] loads persisted data from PostgreSQL
    Flight cards rendered with sort (price/duration/time) and filter (direct only)
```

---

## Health Checks

All services have Docker health checks configured for startup ordering:

| Service | Health Check | Startup Grace |
|---------|-------------|---------------|
| **ollama** | `GET /api/tags` | 15s |
| **browser-use** | `GET /health` | 20s |
| **supabase-db** | `pg_isready -U postgres` | 15s |
| **nextjs** | `GET /api/health` | 30s |

Startup order: `ollama` + `supabase-db` → `browser-use` (depends on `ollama`) → `nextjs` (depends on all three).

```bash
make dev-status    # All services should show (healthy)
```

The Settings page at http://localhost:3000/settings provides a visual dashboard to test each service connection individually.

---

## Debugging & Monitoring

### Container Status & Resources

```bash
# Overview of all containers (health, ports, uptime)
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps

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

### Browser-Use Agent Debugging

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

# Verify deployed code matches local files
docker exec browser-use-browser-use-1 md5sum /app/main.py /app/prompts.py
md5sum browser-service/main.py browser-service/prompts.py

# Run a Python snippet inside the browser-use container
docker exec browser-use-browser-use-1 python3 -c "from main import parse_flight_results; print('parser OK')"
```

### WebSocket Debugging

```bash
# Test WebSocket connection to a running search (replace SEARCH_ID)
# Install: brew install websocat
websocat ws://localhost:8000/ws/search/SEARCH_ID

# Monitor WS connection events in browser-use logs
docker logs browser-use-browser-use-1 -f 2>&1 | grep --line-buffered "WebSocket\|ws/"

# Check Next.js WS proxy activity
docker logs browser-use-nextjs-1 2>&1 | grep -i "websocket\|ws\|upgrade" | tail -10

# Verify WS endpoint is reachable (HTTP upgrade handshake)
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: $(openssl rand -base64 16)" \
  http://localhost:8000/ws/search/test 2>&1 | head -10
```

### Database Inspection

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

# Verify pgvector extension
docker exec browser-use-supabase-db-1 psql -U postgres -c \
  "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"

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
  -d '{"model":"gpt-oss:20b","prompt":"hi","stream":false}' | jq .response
```

### Restarting After Code Changes

```bash
# Restart services (volume mounts auto-pick up code changes)
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart browser-use
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart nextjs

# Full rebuild (after dependency changes to package.json or requirements.txt)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build browser-use nextjs

# Force recreate (resets all container state)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --force-recreate browser-use
```

### Tracing a Specific Search

If a search isn't returning results, trace the full pipeline:

```bash
SEARCH_ID="paste-search-id-here"

# 1. Was the search created?
docker exec browser-use-supabase-db-1 psql -U postgres -c \
  "SELECT id, origin, destination FROM agent_ctx WHERE id = '$SEARCH_ID';"

# 2. What's the agent state?
docker exec browser-use-supabase-db-1 psql -U postgres -c \
  "SELECT status, created_at, completed_at FROM agent_state WHERE agent_ctx_id = '$SEARCH_ID';"

# 3. What did the browser-use agent do?
docker logs browser-use-browser-use-1 2>&1 | grep "$SEARCH_ID" | tail -30

# 4. Did the callback fire?
docker logs browser-use-nextjs-1 2>&1 | grep "$SEARCH_ID" | tail -10

# 5. Were results persisted?
docker exec browser-use-supabase-db-1 psql -U postgres -c \
  "SELECT airline, price, stops FROM flight_results WHERE agent_ctx_id = '$SEARCH_ID';"

# 6. What does the API return?
curl -s "http://localhost:3000/api/results/$SEARCH_ID" | jq '.results | length'
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
make pull-model    # Downloads gpt-oss:20b (~12 GB)
```

### browser-use: Chromium crash or OOM

Ensure `shm_size: '2gb'` is set in `docker-compose.yml` (it is by default). If still crashing, increase Docker Desktop memory allocation to ≥16 GB.

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

---

## Project Status

All **85 / 85** original engineering tasks plus **Epic 7 (OpenAI & UX Enhancements)** with **11** additional tasks are `COMPLETED`. See [SPECS.md](SPECS.md) for full task tracking.

| Epic | Description | Status |
|------|-------------|--------|
| 1 | Local Docker Infrastructure | Done |
| 2 | Next.js Application Scaffold | Done |
| 3 | Flight Search Core | Done |
| 4 | Data Persistence & Agent Memory | Done |
| 5 | Settings & Observability | Done |
| 6 | Production Hardening (error handling, caching, verification) | Done |
| 7 | OpenAI Support & UX Enhancements | Done |

---

## License

Private — All rights reserved.
