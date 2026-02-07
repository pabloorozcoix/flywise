# AeroAgent AI — Engineering Specification

> **Single source of truth** for building the AeroAgent AI flight search application.
> Reference architecture and technical constraints live in [README-PLAN.md](README-PLAN.md).

---

## How to Use This Document

This file is designed for **autonomous agent execution**. Each user story contains Gherkin acceptance criteria and a flat task list. An agent (or engineer) should:

1. Pick the next `TODO` task in order (respect dependencies noted in prerequisites).
2. Set its status to `IN PROGRESS`.
3. Implement, test, and commit.
4. Set status to `COMPLETED`.
5. Repeat.

### Status Legend

| Status | Meaning |
|--------|---------|
| `TODO` | Not started |
| `IN PROGRESS` | Currently being worked on |
| `COMPLETED` | Implemented and verified |
| `BLOCKED` | Waiting on a dependency or decision |

---

## Epic 1 — Local Docker Infrastructure

### US-1.1: Docker Compose Orchestration

```gherkin
Feature: Docker Compose Orchestration
  As a developer
  I want a single `docker compose up` command to start all services
  So that I can develop and test locally without manual setup

  Background:
    Given the project root contains a docker-compose.yml

  Scenario: Start all services
    When I run `docker compose up -d`
    Then containers "nextjs", "ollama", "browser-use", and "supabase-db" are running
    And they share the "aeroagent" Docker network
    And named volumes "ollama_data" and "supabase_data" are created

  Scenario: Service connectivity
    Given all containers are running
    Then nextjs can reach ollama at http://ollama:11434
    And nextjs can reach browser-use at http://browser-use:8000
    And nextjs can reach supabase-db at postgresql://postgres:postgres@supabase-db:5432/postgres

  Scenario: Graceful shutdown
    When I run `docker compose down`
    Then all containers stop
    And data volumes are preserved
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 1.1.1 | Create project root directory structure (`frontend/`, `browser-service/`, `supabase/`) | `COMPLETED` | — |
| 1.1.2 | Write `docker-compose.yml` with all four services, network, and volumes per README-PLAN.md | `COMPLETED` | 1.1.1 |
| 1.1.3 | Create `.env.example` with all required environment variables and defaults | `COMPLETED` | 1.1.2 |
| 1.1.4 | Add a top-level `Makefile` with targets: `up`, `down`, `logs`, `build`, `pull-model` | `COMPLETED` | 1.1.2 |
| 1.1.5 | Validate `docker compose up -d` starts all containers and they reach `healthy` | `TODO` | 1.1.2, 1.2.*, 1.3.*, 1.4.* |

---

### US-1.2: Ollama LLM Container

```gherkin
Feature: Ollama Local LLM
  As a developer
  I want Ollama running in Docker with the gpt-oss:20b model
  So that the application has a local, cost-free LLM

  Scenario: Ollama container starts
    Given the docker-compose.yml defines the ollama service
    When the container starts
    Then port 11434 is exposed to the host
    And the /v1/chat/completions endpoint responds to POST requests

  Scenario: Model is available
    Given the ollama container is running
    When I run `docker compose exec ollama ollama list`
    Then "gpt-oss:20b" appears in the output

  Scenario: GPU passthrough (optional)
    Given the host has an NVIDIA GPU with CUDA drivers
    When the ollama container starts
    Then GPU resources are allocated via deploy.resources.reservations
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 1.2.1 | Configure the `ollama` service in `docker-compose.yml` (image, port, volume, GPU reservation) | `COMPLETED` | 1.1.2 |
| 1.2.2 | Add `Makefile` target `pull-model` that runs `docker compose exec ollama ollama pull gpt-oss:20b` | `COMPLETED` | 1.2.1 |
| 1.2.3 | Add a health check for Ollama (`/api/tags` endpoint) | `COMPLETED` | 1.2.1 |

---

### US-1.3: Browser-Use FastAPI Service

```gherkin
Feature: Browser-Use API Service
  As the Next.js backend
  I want a FastAPI HTTP wrapper around browser-use
  So that I can trigger browser automation tasks via REST

  Background:
    Given browser-use has no built-in HTTP API server
    And a custom FastAPI wrapper is required

  Scenario: Container builds and starts
    Given browser-service/Dockerfile uses python:3.12-slim and system Chromium
    When the container builds
    Then it installs browser-use, fastapi, uvicorn via uv
    And it does NOT run `playwright install` (uses system chromium)

  Scenario: Health endpoint
    Given the browser-use container is running
    When I GET http://localhost:8000/health
    Then I receive 200 with {"status": "ok"}

  Scenario: Search endpoint accepts flight parameters
    Given the browser-use container is running
    When I POST to http://localhost:8000/search with valid FlightSearchRequest JSON
    Then the service creates a Browser(headless=True) instance
    And creates a ChatOllama(model="gpt-oss:20b", host="http://ollama:11434") instance
    And runs an Agent to perform the search
    And returns structured flight results
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 1.3.1 | Create `browser-service/Dockerfile` (python:3.12-slim, system chromium, uv, uvicorn entrypoint) | `COMPLETED` | 1.1.1 |
| 1.3.2 | Create `browser-service/requirements.txt` (browser-use, fastapi, uvicorn, pydantic) | `COMPLETED` | 1.3.1 |
| 1.3.3 | Implement `browser-service/main.py` with FastAPI app, `/health` endpoint | `COMPLETED` | 1.3.2 |
| 1.3.4 | Define `FlightSearchRequest` and `FlightSearchResponse` Pydantic models in `browser-service/models.py` | `COMPLETED` | 1.3.3 |
| 1.3.5 | Implement `POST /search` endpoint using browser-use `Agent`, `Browser`, `ChatOllama` (native imports) | `COMPLETED` | 1.3.4 |
| 1.3.6 | Implement `WebSocket /ws/search/{search_id}` for streaming progress events | `COMPLETED` | 1.3.5 |
| 1.3.7 | Add `shm_size: '2gb'` and health check to docker-compose browser-use service | `COMPLETED` | 1.3.1 |

---

### US-1.4: PostgreSQL + pgvector Database

```gherkin
Feature: PostgreSQL with pgvector
  As the application
  I want a PostgreSQL database with pgvector extension
  So that I can store flight results and agent memory with vector embeddings

  Scenario: Database container starts
    Given the docker-compose.yml defines the supabase-db service
    When the container starts with supabase/postgres:17.6.0.038
    Then PostgreSQL is accessible on port 5432
    And the pgvector extension is available

  Scenario: Schema is initialized
    Given the database container is running
    And supabase/init.sql is mounted to /docker-entrypoint-initdb.d/
    When the container starts for the first time
    Then tables agent_ctx, agent_state, and memory are created
    And the vector(1536) column type is usable

  Scenario: Data persists across restarts
    Given the supabase_data volume is mounted
    When the container is stopped and restarted
    Then all previously inserted data is retained
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 1.4.1 | Configure the `supabase-db` service in `docker-compose.yml` (image, port, env, command, volumes) | `COMPLETED` | 1.1.2 |
| 1.4.2 | Create `supabase/init.sql` with `CREATE EXTENSION IF NOT EXISTS vector;` and table schemas | `COMPLETED` | 1.4.1 |
| 1.4.3 | Add a health check for PostgreSQL (pg_isready) | `COMPLETED` | 1.4.1 |

---

## Epic 2 — Next.js Application Scaffold

### US-2.1: Next.js Project Setup

```gherkin
Feature: Next.js Application Scaffold
  As a developer
  I want a Next.js 16 project with TypeScript, Tailwind CSS v4, and AI SDK
  So that I have a working frontend and API layer

  Scenario: Project initializes
    Given the frontend/ directory exists
    When I run the Next.js build
    Then the project compiles without errors
    And Tailwind CSS is configured
    And TypeScript strict mode is enabled

  Scenario: Dockerfile builds
    Given frontend/Dockerfile exists
    When I run `docker build ./frontend`
    Then the image builds successfully
    And the container serves the app on port 3000
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 2.1.1 | Initialize Next.js 16 project in `frontend/` with TypeScript and Tailwind CSS v4 | `TODO` | 1.1.1 |
| 2.1.2 | Install dependencies: `ai@^6`, `@ai-sdk/openai-compatible@^2`, `@supabase/supabase-js@^2`, `drizzle-orm@^0.45`, `zod@^4`, `jotai@^2.17`, `next-themes@^0.4`, `react-hook-form@^7.71`, `@hookform/resolvers@^5` | `TODO` | 2.1.1 |
| 2.1.3 | Initialize shadcn/ui (`npx shadcn@latest init`), Tailwind v4 dark mode via `@custom-variant dark` in `globals.css` | `TODO` | 2.1.2 |
| 2.1.4 | Add shadcn/ui components: `button`, `input`, `select`, `form`, `label`, `card`, `tabs`, `badge`, `popover`, `calendar`, `switch` | `TODO` | 2.1.3 |
| 2.1.5 | Create `src/components/theme-provider.tsx` (next-themes wrapper) and `src/components/theme-toggle.tsx` | `TODO` | 2.1.3 |
| 2.1.6 | Update root layout (`src/app/layout.tsx`) with `<ThemeProvider attribute="class" defaultTheme="dark">` | `TODO` | 2.1.5 |
| 2.1.7 | Create `frontend/Dockerfile` (multi-stage: deps → build → runner) | `TODO` | 2.1.1 |
| 2.1.8 | Create `src/lib/localOllama.ts` — `createOpenAICompatible` provider for Ollama | `TODO` | 2.1.2 |
| 2.1.9 | Create `src/lib/supabase.ts` — Supabase client configuration | `TODO` | 2.1.2 |
| 2.1.10 | Create `src/db/schema.ts` — Drizzle ORM schema (agent_ctx, agent_state, memory with pgvector) | `TODO` | 2.1.2 |

---

### US-2.2: Ollama Integration & Streaming

```gherkin
Feature: Ollama AI Integration
  As a user
  I want to verify that the local Ollama LLM is connected
  So that I know the AI backend is operational before running searches

  Scenario: Ollama connection test (streaming)
    Given the Ollama container is running with gpt-oss:20b
    When I navigate to the Settings page and click "Test Ollama"
    Then a streaming response appears token-by-token in the UI
    And the response confirms the model is functional

  Scenario: Ollama unreachable
    Given the Ollama container is NOT running
    When I click "Test Ollama"
    Then an error message displays "Unable to connect to Ollama"
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 2.2.1 | Implement `GET /api/ai/ollama-test` route using `streamText` from AI SDK | `TODO` | 2.1.8 |
| 2.2.2 | Create `useOllamaConnectionTest` React hook (fetch + ReadableStream consumer) | `TODO` | 2.2.1 |
| 2.2.3 | Build Settings page with Ollama test tab and streaming output display | `TODO` | 2.2.2 |

---

### US-2.3: Database Connection & pgvector Test

```gherkin
Feature: Database Connectivity
  As a user
  I want to verify the PostgreSQL database and pgvector extension
  So that I know data persistence is operational

  Scenario: Database connection test
    Given the supabase-db container is running
    When I navigate to the Settings page and click "Test Database"
    Then "Connection successful" is displayed
    And the PostgreSQL version is shown

  Scenario: pgvector extension test
    Given the database is connected
    When I click "Test pgvector"
    Then "pgvector extension active" is displayed
    And a sample vector insert/query succeeds

  Scenario: Database unreachable
    Given the supabase-db container is NOT running
    When I click "Test Database"
    Then an error message displays "Unable to connect to database"
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 2.3.1 | Implement `GET /api/db/test-connection` route (SELECT version()) | `TODO` | 2.1.9 |
| 2.3.2 | Implement `GET /api/db/test-pgvector` route (create temp table with vector, insert, query) | `TODO` | 2.3.1 |
| 2.3.3 | Create `useDatabaseConnectionTest` React hook | `TODO` | 2.3.1 |
| 2.3.4 | Add Database test tab to Settings page | `TODO` | 2.3.3, 2.2.3 |

---

## Epic 3 — Flight Search Core

### US-3.1: Flight Search Form

```gherkin
Feature: Flight Search Form
  As a user
  I want to enter flight search parameters
  So that I can initiate an AI-powered flight search

  Scenario: Render search form
    Given I am on the home page
    Then I see input fields for: origin, destination, departure date, return date
    And I see dropdowns for: cabin class (Economy, Business, First)
    And I see a toggle for "Direct flights only"
    And a "Search Flights" button

  Scenario: Form validation
    Given I am on the home page
    When I submit the form with origin empty
    Then a validation error "Origin is required" is displayed
    And the form is NOT submitted

  Scenario: Submit triggers search
    Given I fill in origin="JFK", destination="LHR", date="2026-03-15"
    When I click "Search Flights"
    Then a POST request is sent to /api/search
    And I am redirected to /search/{id} with a loading state
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 3.1.1 | Define `FlightSearchParams` Zod schema (origin, destination, departureDate, returnDate, cabinClass, directOnly) | `TODO` | 2.1.2 |
| 3.1.2 | Build `<SearchForm />` component with controlled inputs and Zod validation | `TODO` | 3.1.1 |
| 3.1.3 | Build home page (`app/page.tsx`) rendering `<SearchForm />` | `TODO` | 3.1.2 |
| 3.1.4 | Implement `POST /api/search` route (validate params, generate search ID, call browser-use service, persist to DB) | `TODO` | 3.1.1, 2.1.9 |
| 3.1.5 | Wire form submission to API route and redirect to `/search/[id]` | `TODO` | 3.1.3, 3.1.4 |

---

### US-3.2: Live Execution Timeline

```gherkin
Feature: Live Execution Timeline
  As a user
  I want to see real-time progress of the AI agent browsing Google Flights
  So that I understand what the agent is doing and feel confident in the results

  Scenario: Execution page loads
    Given I have submitted a flight search
    When I land on /search/{id}
    Then I see a vertical timeline with a "Starting…" step
    And a status indicator shows "Agent is working…"

  Scenario: Progress updates stream in
    Given the agent is running
    When the browser-use service emits progress events via WebSocket
    Then each event appears as a new timeline entry
    And entries show: timestamp, action description, optional screenshot thumbnail
    And the timeline scrolls to the latest entry

  Scenario: Agent completes
    Given the agent has finished the search
    When the "done" event is received
    Then the timeline shows a final "Search complete" entry with a green checkmark
    And a "View Results" button appears

  Scenario: Agent encounters an error
    Given the agent fails mid-execution
    When an error event is received
    Then the timeline shows a red error entry with the message
    And a "Retry" button appears
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 3.2.1 | Design `AgentEvent` TypeScript type (id, timestamp, type, message, screenshotUrl?) | `TODO` | — |
| 3.2.2 | Build `<ExecutionTimeline />` component (vertical list of `AgentEvent` entries) | `TODO` | 3.2.1 |
| 3.2.3 | Build `<AgentStatus />` component (running/completed/error indicator) | `TODO` | 3.2.1 |
| 3.2.4 | Implement `useSearchExecution` hook (WebSocket connection to browser-use `/ws/search/{id}`) | `TODO` | 3.2.1, 1.3.6 |
| 3.2.5 | Build execution page (`app/search/[id]/page.tsx`) composing Timeline + Status | `TODO` | 3.2.2, 3.2.3, 3.2.4 |
| 3.2.6 | Add `GET /api/status/[id]` polling fallback route for when WebSocket is unavailable | `TODO` | 3.2.5 |

---

### US-3.3: Flight Results Display

```gherkin
Feature: Flight Results Display
  As a user
  I want to see the extracted flight results in a structured, sortable view
  So that I can compare options and find the best flight

  Scenario: Results page renders
    Given a search has completed with results
    When I navigate to /results/{id}
    Then I see a grid/list of flight cards
    And each card shows: airline, departure/arrival times, duration, stops, price

  Scenario: Sort results
    Given results are displayed
    When I click "Sort by Price"
    Then the cards reorder from lowest to highest price

  Scenario: Filter direct flights
    Given results include direct and connecting flights
    When I toggle "Direct flights only"
    Then only non-stop flights are shown

  Scenario: No results
    Given the agent completed but extracted zero flights
    Then I see "No flights found" with a suggestion to adjust dates or airports
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 3.3.1 | Define `FlightResult` TypeScript type (airline, departure, arrival, duration, stops, price, currency, url) | `TODO` | — |
| 3.3.2 | Build `<FlightCard />` component rendering a single flight result | `TODO` | 3.3.1 |
| 3.3.3 | Build results page (`app/results/[id]/page.tsx`) with card grid, sort controls, and filter toggle | `TODO` | 3.3.2 |
| 3.3.4 | Implement data fetching: load results from Supabase by search ID | `TODO` | 3.3.3, 2.1.9 |
| 3.3.5 | Implement client-side sorting (price, duration, departure time) and filtering (direct only) | `TODO` | 3.3.3 |

---

### US-3.4: Browser-Use Agent Task Prompt

```gherkin
Feature: Flight Search Agent Prompt
  As the system
  I want a well-structured browser-use agent prompt for Google Flights
  So that the agent reliably navigates, searches, and extracts flight data

  Scenario: Agent navigates to Google Flights
    Given the agent receives a FlightSearchRequest
    When the agent starts
    Then it navigates to https://www.google.com/travel/flights

  Scenario: Agent fills search form
    Given the agent is on Google Flights
    When it processes the search parameters
    Then it enters the origin and destination airports
    And sets the departure date
    And sets cabin class if specified
    And toggles "Nonstop only" if directOnly is true

  Scenario: Agent extracts results
    Given the Google Flights results page has loaded
    When the agent uses the extract action
    Then it returns structured JSON with all visible flight options
    And each option includes airline, times, duration, stops, and price

  Scenario: Agent handles errors gracefully
    Given the agent encounters anti-bot detection or a timeout
    Then it retries up to max_failures times
    And reports the error via WebSocket if all retries fail
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 3.4.1 | Write the agent task prompt template in `browser-service/prompts.py` | `TODO` | 1.3.5 |
| 3.4.2 | Implement `parse_flight_results(history: AgentHistoryList) -> list[FlightResult]` parser | `TODO` | 3.4.1 |
| 3.4.3 | Add stealth settings to Browser config (user-agent rotation, random delays) | `TODO` | 3.4.1 |
| 3.4.4 | Add structured output via `output_model_schema` Pydantic model for reliable extraction | `TODO` | 3.4.2 |

---

## Epic 4 — Data Persistence & Agent Memory

### US-4.1: Search Result Persistence

```gherkin
Feature: Persist Search Results
  As the system
  I want to save every search and its results to PostgreSQL
  So that users can revisit past searches and results are cached

  Scenario: Search is persisted on creation
    Given a user submits a flight search
    When the /api/search route processes the request
    Then a new row is inserted into agent_ctx with the search parameters
    And a new row is inserted into agent_state with status "running"

  Scenario: Results are persisted on completion
    Given the browser-use agent has completed a search
    When the results are parsed
    Then each flight result is inserted into a flight_results table
    And the agent_state row is updated to status "completed"

  Scenario: Retrieve past search results
    Given a search ID exists in the database
    When I GET /api/results/{id}
    Then the flight results for that search are returned as JSON
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 4.1.1 | Add `flight_results` table to Drizzle schema and SQL init script | `TODO` | 2.1.10, 1.4.2 |
| 4.1.2 | Implement DB insert in `POST /api/search` (create agent_ctx + agent_state rows) | `TODO` | 3.1.4, 4.1.1 |
| 4.1.3 | Implement callback from browser-use service to persist results and update agent_state | `TODO` | 4.1.2, 3.4.2 |
| 4.1.4 | Implement `GET /api/results/[id]` route to fetch results by search ID | `TODO` | 4.1.1 |

---

### US-4.2: Agent Memory with Embeddings

```gherkin
Feature: Agent Memory with Vector Embeddings
  As the system
  I want to store agent reasoning steps as vector embeddings
  So that future searches can benefit from semantic memory retrieval

  Scenario: Agent step is stored with embedding
    Given the agent completes a step during a search
    When the step text is processed
    Then a row is inserted into the memory table
    And the embedding column contains a 1536-dimension vector

  Scenario: Semantic search over memory
    Given multiple memories exist in the database
    When I query with a text string
    Then the most semantically similar memories are returned
    And results are ordered by cosine similarity
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 4.2.1 | Implement embedding generation (via Ollama `/api/embeddings` or a local embedding model) | `TODO` | 1.2.1 |
| 4.2.2 | Store agent step summaries + embeddings in the memory table after each search | `TODO` | 4.2.1, 4.1.3 |
| 4.2.3 | Implement a semantic similarity query endpoint `GET /api/memory/search?q=...` | `TODO` | 4.2.2 |

---

## Epic 5 — Settings & Observability

### US-5.1: Settings Dashboard

```gherkin
Feature: Settings Dashboard
  As a developer
  I want a settings page with connectivity tests for all services
  So that I can diagnose issues without leaving the application

  Scenario: Settings page renders tabs
    Given I navigate to /settings
    Then I see tabs: "Ollama", "Database", "Browser-Use", "System"

  Scenario: Ollama tab
    Given I click the "Ollama" tab
    Then I see model info, a streaming test button, and connection status

  Scenario: Database tab
    Given I click the "Database" tab
    Then I see connection status, pgvector test, and table row counts

  Scenario: Browser-Use tab
    Given I click the "Browser-Use" tab
    Then I see health status of the browser-use service
    And an option to run a diagnostic browser task

  Scenario: System tab
    Given I click the "System" tab
    Then I see Docker container statuses, resource usage, and uptime
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 5.1.1 | Build Settings page layout with tab navigation (`app/settings/page.tsx`) | `TODO` | 2.1.1 |
| 5.1.2 | Integrate Ollama test tab (reuse `useOllamaConnectionTest` hook from US-2.2) | `TODO` | 2.2.3, 5.1.1 |
| 5.1.3 | Integrate Database test tab (reuse hooks from US-2.3) | `TODO` | 2.3.4, 5.1.1 |
| 5.1.4 | Build Browser-Use health check tab (`GET /api/browser-use/health` → proxy to browser-use `/health`) | `TODO` | 1.3.3, 5.1.1 |
| 5.1.5 | Build System info tab (container statuses via Docker API or health endpoints) | `TODO` | 5.1.1 |

---

### US-5.2: Health Checks & Monitoring

```gherkin
Feature: Container Health Checks
  As the Docker infrastructure
  I want health checks on all containers
  So that depends_on with condition: service_healthy works and failures are detected

  Scenario: Ollama health check
    Given the ollama container is running
    When Docker pings /api/tags
    Then the health check passes

  Scenario: Browser-Use health check
    Given the browser-use container is running
    When Docker pings /health
    Then the health check passes

  Scenario: PostgreSQL health check
    Given the supabase-db container is running
    When Docker runs pg_isready
    Then the health check passes

  Scenario: Next.js health check
    Given the nextjs container is running
    When Docker pings /api/health
    Then the health check passes
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 5.2.1 | Add `healthcheck` to all services in `docker-compose.yml` | `TODO` | 1.1.2 |
| 5.2.2 | Add `depends_on` with `condition: service_healthy` for service startup ordering | `TODO` | 5.2.1 |
| 5.2.3 | Implement `GET /api/health` in the Next.js app | `TODO` | 2.1.1 |

---

## Epic 6 — Production Hardening

### US-6.1: Error Handling & Retries

```gherkin
Feature: Robust Error Handling
  As the system
  I want graceful error handling and automatic retries
  So that transient failures in browser automation do not crash the search

  Scenario: Browser-use agent retries on failure
    Given the agent encounters a navigation timeout
    When max_failures has not been reached
    Then the agent retries the failed step
    And a retry event is emitted via WebSocket

  Scenario: All retries exhausted
    Given the agent has exhausted max_failures retries
    Then the search status is set to "failed" in the database
    And the user sees an error with a "Retry Search" button

  Scenario: Browser-use service returns error to Next.js
    Given the browser-use /search endpoint encounters an unrecoverable error
    When it responds with a 500 status
    Then the Next.js API route relays a user-friendly error to the frontend
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 6.1.1 | Configure `max_failures=3` and `final_response_after_failure=True` on the Agent | `TODO` | 1.3.5 |
| 6.1.2 | Implement error event emission in WebSocket stream | `TODO` | 1.3.6 |
| 6.1.3 | Add try/catch + error response handling in `POST /api/search` Next.js route | `TODO` | 3.1.4 |
| 6.1.4 | Add "Retry Search" button on the execution page when status is "failed" | `TODO` | 3.2.5 |

---

### US-6.2: Caching & Rate Limiting

```gherkin
Feature: Result Caching
  As the system
  I want to cache recent search results
  So that identical searches return instantly without re-scraping

  Scenario: Cache hit
    Given a search for JFK → LHR on 2026-03-15 was completed 10 minutes ago
    When another user searches JFK → LHR on 2026-03-15
    Then cached results are returned immediately
    And no browser-use agent is spawned

  Scenario: Cache miss
    Given no cached results exist for the search parameters
    When the search is submitted
    Then a new browser-use agent is spawned

  Scenario: Cache expiry
    Given cached results are older than 60 minutes
    When a matching search is submitted
    Then the cache is invalidated
    And a new agent is spawned
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 6.2.1 | Implement cache lookup in `POST /api/search` (query DB for matching recent results) | `TODO` | 4.1.2 |
| 6.2.2 | Define cache TTL (default 60 minutes) as environment variable | `TODO` | 1.1.3 |
| 6.2.3 | Add request rate limiting (max N concurrent searches) in the browser-use service | `TODO` | 1.3.5 |

---

### US-6.3: Result Verification

```gherkin
Feature: Flight Result Verification
  As a user
  I want the system to verify extracted prices are accurate
  So that I can trust the results before booking

  Scenario: Price verification
    Given the agent has extracted flight results
    When results are returned to the user
    Then each result includes a "verified" or "unverified" badge
    And the verification timestamp is shown

  Scenario: Multi-source validation (future)
    Given results from Google Flights are available
    When a secondary source confirms the price (within 5% tolerance)
    Then the result is marked as "verified"
```

#### Tasks

| # | Task | Status | Prerequisites |
|---|------|--------|---------------|
| 6.3.1 | Add `verified` boolean and `verifiedAt` timestamp fields to `FlightResult` type and DB schema | `TODO` | 3.3.1, 4.1.1 |
| 6.3.2 | Display verification badge on `<FlightCard />` | `TODO` | 6.3.1, 3.3.2 |
| 6.3.3 | Stub multi-source verification API route for future implementation | `TODO` | 6.3.1 |

---

## Task Summary

| Epic | Story | Total Tasks | Completed |
|------|-------|-------------|-----------|
| 1 — Infrastructure | US-1.1: Docker Compose | 5 | 0 |
| 1 — Infrastructure | US-1.2: Ollama | 3 | 0 |
| 1 — Infrastructure | US-1.3: Browser-Use | 7 | 0 |
| 1 — Infrastructure | US-1.4: PostgreSQL | 3 | 0 |
| 2 — App Scaffold | US-2.1: Next.js Setup | 10 | 0 |
| 2 — App Scaffold | US-2.2: Ollama Integration | 3 | 0 |
| 2 — App Scaffold | US-2.3: Database Test | 4 | 0 |
| 3 — Flight Search | US-3.1: Search Form | 5 | 0 |
| 3 — Flight Search | US-3.2: Live Timeline | 6 | 0 |
| 3 — Flight Search | US-3.3: Results Display | 5 | 0 |
| 3 — Flight Search | US-3.4: Agent Prompt | 4 | 0 |
| 4 — Persistence | US-4.1: Result Storage | 4 | 0 |
| 4 — Persistence | US-4.2: Agent Memory | 3 | 0 |
| 5 — Settings | US-5.1: Settings Dashboard | 5 | 0 |
| 5 — Settings | US-5.2: Health Checks | 3 | 0 |
| 6 — Hardening | US-6.1: Error Handling | 4 | 0 |
| 6 — Hardening | US-6.2: Caching | 3 | 0 |
| 6 — Hardening | US-6.3: Verification | 3 | 0 |
| **Total** | | **85** | **0** |

---

## Dependency Graph

```
Epic 1 (Infrastructure)
  └─► Epic 2 (App Scaffold)
        ├─► Epic 3 (Flight Search Core)
        │     └─► Epic 4 (Persistence)
        │           └─► Epic 6 (Hardening)
        └─► Epic 5 (Settings & Observability)
```

> **Execution order:** Complete Epic 1 first. Epics 2 and 5 can proceed in parallel once infrastructure is up. Epic 3 depends on Epic 2. Epic 4 depends on Epics 2 and 3. Epic 6 depends on Epics 3 and 4.
