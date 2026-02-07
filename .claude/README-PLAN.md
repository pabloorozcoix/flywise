# AeroAgent AI - Flight Search Application Plan

## Overview

This document analyzes the feasibility of building an AI-powered flight search application using a **fully local, Docker-based architecture** with no cloud dependencies:

- **Next.js** - Frontend and API routes (Docker container)
- **AI SDK** - AI/LLM integration with `@ai-sdk/openai-compatible`
- **shadcn/ui** - UI components (Radix UI + Tailwind CSS v4) with dark mode via `next-themes`
- **Ollama** - Local open source LLM (`gpt-oss:20b` model) (Docker container)
- **Supabase Local** - PostgreSQL database with pgvector for embeddings (Docker containers)
- **browser-use** - AI-powered browser automation with local Chromium (Docker container)

### 🐳 100% Local - No Cloud Required

All services run locally via Docker Compose. No external API keys, no cloud costs, full data privacy.

Based on the provided mockups, the application ("AeroAgent AI") would:
1. Accept flight search parameters (origin, destination, dates, class)
2. Use AI agents to navigate Google Flights and extract results
3. Display a live execution timeline showing agent progress
4. Present verified flight results with pricing

---

## Technology Analysis

### browser-use

**What it is:** An open-source Python library (77.9k+ GitHub stars) that enables AI agents to control web browsers using natural language commands.

**Key Features:**
- AI-powered browser automation using Playwright/Chromium
- Native LLM integrations (NOT langchain) — `ChatOllama`, `ChatOpenAI`, `ChatAnthropic`, `ChatGoogle`, etc.
- Can navigate websites, fill forms, extract data
- Provides sandboxed execution environments
- Ships with Docker support for containerized deployment (official Dockerfile uses `python:3.12-slim`)
- CLI with interactive TUI, headless mode (`--prompt`), and MCP server mode (`--mcp`)

**Technical Considerations:**
- **Primary language: Python** (98.8% of codebase), v0.11.9
- Requires async/await patterns
- Uses system Chromium (not `playwright install`) in Docker
- **No built-in HTTP/API server** — users must build their own FastAPI wrapper
- Can run entirely locally with native `ChatOllama` integration (`ollama>=0.5.1` SDK)

### Vercel AI SDK

**What it is:** A TypeScript toolkit for building AI-powered applications with React, Next.js, and other frameworks.

**Key Features:**
- Unified API for multiple LLM providers
- Streaming support for real-time responses
- UI hooks (`useChat`, `useObject`) for building chat interfaces
- Tool calling and agent building capabilities
- **`@ai-sdk/openai-compatible`** (v2.x) for connecting to local Ollama via `createOpenAICompatible()`

**Technical Considerations:**
- **Primary language: TypeScript/JavaScript**
- AI SDK 6 is the latest major version
- Works in both serverless and containerized environments
- Excellent streaming support (`streamText`, `generateText`)
- MCP (Model Context Protocol) tool support

### Ollama (Open Source LLM)

**What it is:** A local LLM runtime that allows running open source models on your own hardware, providing an OpenAI-compatible API.

**Key Features:**
- Run open source models locally (no API costs)
- OpenAI-compatible REST API at `http://localhost:11434/v1`
- Supports multiple models including `gpt-oss:20b`
- No API key required for local usage
- Full control over model and data

**Integration with AI SDK:**
```typescript
// src/lib/localOllama.ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export const localOllama = createOpenAICompatible({
  name: 'ollama',
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'not-required',
});

export const OLLAMA_MODEL = 'gpt-oss:20b';
```

**Streaming Example:**
```typescript
// src/app/api/ai/ollama-test/route.ts
import { streamText } from 'ai';
import { localOllama, OLLAMA_MODEL } from '@/lib/localOllama';

export async function GET() {
  const result = streamText({
    model: localOllama(OLLAMA_MODEL),
    messages: [
      { role: 'system', content: 'You are a helpful flight search assistant.' },
      { role: 'user', content: 'Find the best flights from JFK to LHR.' },
    ],
  });
  return result.toTextStreamResponse();
}
```

### Supabase (Database + pgvector)

**What it is:** An open source Firebase alternative providing PostgreSQL database with pgvector extension for AI embeddings.

**Key Features:**
- PostgreSQL database with full SQL support
- pgvector extension for vector embeddings (1536 dimensions)
- Local development with `npx supabase start`
- Real-time subscriptions
- Row Level Security (RLS)

**Environment Configuration:**
```bash
# .env.local
# If using Supabase Postgres image directly (this plan):
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres

# If using full Supabase self-hosted stack (optional):
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:8000
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
# DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
```

**Client Configuration:**
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!);
```

---

## Feasibility Assessment

### ⚠️ Core Challenge: Language Mismatch

The fundamental challenge is that **browser-use is Python** while **AI SDK is TypeScript**. These don't directly integrate, requiring an architectural bridge.

### Feasibility: **YES, fully local with Docker**

The application is feasible using a Docker Compose architecture that orchestrates all services locally.

---

## Architecture: Fully Local Docker Setup ⭐

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Docker Compose Network                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    nextjs (localhost:3000)                          │    │
│  │  Frontend (React)          │  API Routes (TypeScript)               │    │
│  │  - Flight search form      │  - /api/search                         │    │
│  │  - Live execution view     │  - Stream progress via SSE             │    │
│  │  - Results display         │  - Call browser-use service            │    │
│  │  - AI SDK useChat hooks    │  - Connect to Ollama for LLM           │    │
│  └─────────────────────────────┴───────────────────────────────────────┘    │
│                                      │                                       │
│              ┌───────────────────────┼───────────────────────┐              │
│              │                       │                       │              │
│              ▼                       ▼                       ▼              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │  browser-use        │  │  ollama             │  │  supabase-db        │  │
│  │  (localhost:8000)   │  │  (localhost:11434)  │  │  (localhost:5432)   │  │
│  ├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤  │
│  │  - Custom FastAPI   │  │  - gpt-oss:20b      │  │  - PostgreSQL       │  │
│  │  - browser-use lib  │  │  - OpenAI-compat    │  │  - pgvector         │  │
│  │  - Chromium (sys)   │  │  - No API key       │  │  - REST API         │  │
│  │  - Native ChatOllama│  │  - Local inference  │  │  - Realtime         │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Next.js Frontend & API
  nextjs:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - OLLAMA_HOST=http://ollama:11434
      - BROWSER_USE_API_URL=http://browser-use:8000
      - NEXT_PUBLIC_SUPABASE_URL=http://supabase-db:5432
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    depends_on:
      - ollama
      - browser-use
      - supabase-db
    networks:
      - aeroagent

  # Ollama LLM Server
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    networks:
      - aeroagent

  # Browser-Use Python Service
  browser-use:
    build:
      context: ./browser-service
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - OLLAMA_HOST=http://ollama:11434
    depends_on:
      - ollama
    shm_size: '2gb'  # Required for Chromium
    networks:
      - aeroagent

  # PostgreSQL + pgvector (using Supabase Postgres image)
  # Note: This is the database only. For full Supabase (Auth, Storage, Realtime,
  # Studio), clone https://github.com/supabase/supabase and use their
  # docker-compose.yml which orchestrates ~15 services (Kong, GoTrue, etc.).
  # For this project, the PostgreSQL + pgvector image is sufficient.
  supabase-db:
    image: supabase/postgres:17.6.0.038
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=postgres
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    volumes:
      - supabase_data:/var/lib/postgresql/data
      - ./supabase/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - aeroagent

volumes:
  ollama_data:
  supabase_data:

networks:
  aeroagent:
    driver: bridge
```

### Benefits of Local Docker Architecture

| Benefit | Description |
|---------|-------------|
| **Zero Cloud Costs** | All services run locally, no API fees |
| **Full Data Privacy** | Flight searches never leave your machine |
| **Offline Capable** | Works without internet (except for flight searches) |
| **Reproducible** | Same setup on any machine with Docker |
| **Development Friendly** | Hot reload, easy debugging, full control |
| **GPU Acceleration** | Ollama can use local GPU for faster inference |

---

## Recommended Implementation Plan

### Phase 1: Local Docker Infrastructure

1. **Docker Compose Setup**
   - Configure all services (Next.js, Ollama, browser-use, Supabase)
   - Set up shared Docker network
   - Configure volumes for data persistence

2. **Ollama Container**
   - Pull and configure `gpt-oss:20b` model
   - Expose OpenAI-compatible API on port 11434
   - Configure GPU passthrough (if available)

3. **Browser-Use Service**
   - Custom FastAPI server wrapping browser-use (no built-in API server)
   - System Chromium (not `playwright install`)
   - WebSocket support for live progress updates

4. **PostgreSQL + pgvector (Supabase Postgres image)**
   - `supabase/postgres` Docker image with pgvector pre-installed
   - Initialize schema with Drizzle ORM migrations
   - For full Supabase (Auth, Storage, Realtime, Studio), use their multi-service docker-compose

### Phase 2: Next.js Frontend

1. **Frontend (Next.js + AI SDK)**
   - Flight search form component
   - Real-time execution display using SSE
   - Results grid with sorting/filtering

2. **Backend API Routes**
   - `/api/search` - Initiate flight search (calls browser-use service)
   - `/api/status/[id]` - Poll execution status
   - `/api/ai/chat` - LLM interaction via Ollama

3. **Core Features**
   - Origin/destination selection
   - Date picker with flexible dates option
   - Class selection (Economy, Business, etc.)
   - Direct flights only toggle

### Phase 3: Enhanced Live Execution

```typescript
// Example: Streaming execution updates with Ollama
import { streamText } from 'ai';
import { localOllama, OLLAMA_MODEL } from '@/lib/localOllama';

export async function POST(req: Request) {
  const { origin, destination, date } = await req.json();

  // Stream agent execution steps using local Ollama
  const result = await streamText({
    model: localOllama(OLLAMA_MODEL),
    system: `You are a flight search agent. Analyze flight options and provide recommendations.`,
    prompt: `Find flights from ${origin} to ${destination} on ${date}`,
    onStepFinish: async (step) => {
      // Emit progress updates
    },
  });

  return result.toDataStreamResponse();
}
```

### Phase 4: Local Production Hardening

- Add Redis container for caching
- Implement local rate limiting
- Add error handling and retries
- Implement result verification (as shown in mockups)
- Add health checks for all containers

---

## Technical Implementation Details

### Frontend Structure

Components follow the **directory-per-component** pattern. State management uses **Jotai** atoms (no React Context for state, no prop drilling).

```
/app
  /page.tsx                 # Home with search form
  /search/[id]/page.tsx     # Live execution view
  /results/[id]/page.tsx    # Results display
  /api
    /search/route.ts        # Initiate search
    /status/[id]/route.ts   # Get execution status
/components
  /SearchForm/
    index.ts                # Barrel export
    SearchForm.tsx           # Component implementation
    types.ts                 # Props & local types
    hooks/useSearchForm.ts   # Component-specific hook
    constants.ts             # Defaults & options
    atoms.ts                 # Jotai atoms for shared state
  /ExecutionTimeline/
    index.ts
    ExecutionTimeline.tsx
    types.ts
    hooks/useExecutionTimeline.ts
    atoms.ts
  /FlightCard/
    index.ts
    FlightCard.tsx
    types.ts
  /AgentStatus/
    index.ts
    AgentStatus.tsx
    types.ts
```

### Key Dependencies

```json
{
  "dependencies": {
    "next": "^16.x",
    "react": "^19.x",
    "ai": "^6.0.77",
    "@ai-sdk/openai-compatible": "^2.0.28",
    "@supabase/supabase-js": "^2.95.x",
    "drizzle-orm": "^0.45.x",
    "zod": "^4.x",
    "jotai": "^2.17.x",
    "tailwindcss": "^4.x",
    "next-themes": "^0.4.x",
    "react-hook-form": "^7.71.x",
    "@hookform/resolvers": "^5.x",
    "class-variance-authority": "^0.7.x",
    "clsx": "^2.x",
    "tailwind-merge": "^3.x",
    "tw-animate-css": "^1.x",
    "lucide-react": "^0.563.x",
    "@radix-ui/react-slot": "^1.x",
    "@radix-ui/react-label": "^2.x",
    "@radix-ui/react-select": "^2.x",
    "@radix-ui/react-popover": "^1.x",
    "@radix-ui/react-tabs": "^1.x",
    "@radix-ui/react-switch": "^1.x"
  }
}
```

> **shadcn/ui:** Components are installed as source files in `src/components/ui/` via
> `npx shadcn@latest add <component>`. They are NOT npm packages — they are owned,
> editable files built on Radix UI primitives + Tailwind CSS + `class-variance-authority`.
```

### Browser-Use Docker Service

> **Note:** browser-use has NO built-in HTTP API server. The official Docker image
> runs the `browser-use` CLI (interactive TUI or `--prompt` mode). To expose it
> as a REST API, we build a custom FastAPI wrapper.

```dockerfile
# browser-service/Dockerfile
FROM python:3.12-slim

# Install system Chromium (same approach as official browser-use Dockerfile)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv for fast package management (same as official Dockerfile)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install Python dependencies
COPY requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt

# browser-use uses system chromium, no need for `playwright install`

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```python
# browser-service/main.py
from fastapi import FastAPI, WebSocket
from browser_use import Agent, Browser, ChatOllama  # Native imports (NOT langchain)
import asyncio
import os

app = FastAPI()

# Connect to Ollama container
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434")

@app.post("/search")
async def search_flights(request: FlightSearchRequest):
    # Use local browser (headless=True for Docker, auto-detects if None)
    browser = Browser(headless=True)
    
    # Use native ChatOllama (uses ollama SDK, not langchain)
    llm = ChatOllama(
        model="gpt-oss:20b",
        host=OLLAMA_HOST,  # Note: parameter is 'host', not 'base_url'
    )
    
    agent = Agent(
        task=f"""
        Go to Google Flights.
        Search for flights from {request.origin} to {request.destination}
        on {request.date}.
        Extract all flight options with prices, times, and airlines.
        Return structured JSON data.
        """,
        llm=llm,
        browser=browser,
    )
    
    history = await agent.run()
    return parse_flight_results(history)

@app.websocket("/ws/search/{search_id}")
async def websocket_search(websocket: WebSocket, search_id: str):
    await websocket.accept()
    # Stream progress updates to frontend
    ...
```

---

## OGTO Settings Integration Architecture

The application includes a Settings section for testing and configuring AI/database connectivity:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Settings Component                              │
│  src/components/settings/index.tsx                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐       │
│   │  Ollama Test    │   │  Database Test  │   │  Google Search  │       │
│   │  Tab            │   │  Tab            │   │  Tab            │       │
│   └────────┬────────┘   └────────┬────────┘   └─────────────────┘       │
│            │                     │                                       │
│            ▼                     ▼                                       │
│   ┌─────────────────┐   ┌─────────────────┐                             │
│   │ useOllamaTest   │   │ useDbTest       │   Custom React Hooks        │
│   │ Hook            │   │ Hook            │                             │
│   └────────┬────────┘   └────────┬────────┘                             │
│            │                     │                                       │
└────────────┼─────────────────────┼───────────────────────────────────────┘
             │                     │
             ▼                     ▼
┌─────────────────────┐   ┌─────────────────────┐
│ /api/ai/ollama-test │   │ /api/db/test-*      │   API Routes
└────────┬────────────┘   └────────┬────────────┘
         │                         │
         ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐
│ src/lib/            │   │ src/lib/            │
│ localOllama.ts      │   │ supabase.ts         │   Library Modules
└────────┬────────────┘   └────────┬────────────┘
         │                         │
         ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐
│   Ollama Server     │   │  PostgreSQL +       │   External Services
│   localhost:11434   │   │  pgvector            │
└─────────────────────┘   │  localhost:5432     │
                          └─────────────────────┘
```

### React Hook for Ollama Streaming

```typescript
// src/components/settings/components/OllamaConnectionTest/hooks/useOllamaConnectionTest.ts
import { useState, useTransition } from "react";

export function useOllamaConnectionTest() {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleTest() {
    setText("");
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/ai/ollama-test");
        if (!response.body) throw new Error("No response body");
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let result = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          result += decoder.decode(value, { stream: true });
          setText(result);  // Update UI incrementally
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    });
  }

  return { text, error, isPending, handleTest };
}
```

### Database Schema with pgvector (Drizzle ORM)

```typescript
// src/db/schema.ts
import {
  pgTable, uuid, text, integer, numeric, timestamp, index, customType,
} from "drizzle-orm/pg-core";

// Custom type for pgvector embeddings
const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() { return "vector(1536)"; },
  toDriver(value) { return `[${value.join(",")}]`; },
  fromDriver(value) {
    const trimmed = value.trim().replace(/^\[/, "").replace(/\]$/, "");
    return trimmed ? trimmed.split(",").map((v) => Number(v.trim())) : [];
  },
});

// Agent context table
export const agent_ctx = pgTable("agent_ctx", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent_name: text("agent_name").notNull(),
  agent_role: text("agent_role").notNull(),
  goal_title: text("goal_title").notNull(),
  goal_system_prompt: text("goal_system_prompt").notNull(),
  model: text("model").notNull(),
  model_temperature: numeric("model_temperature").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Agent state table (runs)
export const agent_state = pgTable("agent_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent_ctx_id: uuid("agent_ctx_id").references(() => agent_ctx.id),
  iterations_completed: integer("iterations_completed").notNull(),
  tokens_used: integer("tokens_used").notNull(),
  status: text("status"),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Memory with vector embeddings for semantic search
export const memory = pgTable("memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent_state_id: uuid("agent_state_id").references(() => agent_state.id),
  text: text("text").notNull(),
  embedding: vector1536("embedding"),  // pgvector column
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

### Dark Mode & Theme

The application uses **next-themes** with shadcn/ui for dark mode support:

```typescript
// src/components/theme-provider.tsx
"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

```typescript
// src/app/layout.tsx (root layout)
import { ThemeProvider } from "@/components/theme-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### Form Architecture (shadcn/ui + react-hook-form + zod)

All forms use the shadcn/ui `<Form>` component, which integrates `react-hook-form` with Zod validation:

```typescript
// Example: Flight search form using shadcn/ui Form
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { flightSearchSchema, type FlightSearchParams } from "@/lib/schemas";

const form = useForm<FlightSearchParams>({
  resolver: zodResolver(flightSearchSchema),
  defaultValues: { origin: "", destination: "", cabinClass: "economy" },
});
```

### Full Project Structure

```
src/
├── lib/
│   ├── utils.ts            # cn() class merge utility (from shadcn init)
│   ├── localOllama.ts      # Ollama client configuration
│   └── supabase.ts         # Supabase client configuration
├── db/
│   └── schema.ts           # Drizzle ORM schema definitions
├── app/
│   ├── layout.tsx          # Root layout with ThemeProvider (dark mode)
│   ├── globals.css         # Tailwind + shadcn/ui CSS variables (light/dark)
│   ├── page.tsx            # Home with search form
│   ├── search/[id]/page.tsx # Live execution view
│   ├── results/[id]/page.tsx # Results display
│   └── api/
│       ├── ai/
│       │   └── ollama-test/
│       │       └── route.ts    # Ollama stream test API
│       ├── db/
│       │   ├── test-connection/
│       │   │   └── route.ts    # Supabase connection test
│       │   └── test-pgvector/
│       │       └── route.ts    # pgvector extension test
│       ├── search/
│       │   └── route.ts        # Initiate flight search
│       └── status/[id]/
│           └── route.ts        # Get execution status
└── components/
    ├── ui/                     # shadcn/ui components (auto-generated, editable)
    │   ├── button.tsx
    │   ├── input.tsx
    │   ├── label.tsx
    │   ├── select.tsx
    │   ├── form.tsx            # react-hook-form integration
    │   ├── card.tsx
    │   ├── tabs.tsx
    │   ├── badge.tsx
    │   ├── popover.tsx
    │   ├── calendar.tsx
    │   ├── switch.tsx
    │   └── ...
    ├── theme-provider.tsx      # next-themes ThemeProvider wrapper
    ├── theme-toggle.tsx        # Dark/light mode toggle button
    ├── SearchForm/
    │   ├── index.ts            # Barrel export
    │   ├── SearchForm.tsx      # Uses shadcn/ui Form, Input, Select, Button
    │   ├── types.ts
    │   ├── hooks/useSearchForm.ts
    │   ├── constants.ts
    │   └── atoms.ts            # Jotai atoms for shared state
    ├── ExecutionTimeline/
    │   ├── index.ts
    │   ├── ExecutionTimeline.tsx
    │   ├── types.ts
    │   ├── hooks/useExecutionTimeline.ts
    │   └── atoms.ts
    ├── FlightCard/
    │   ├── index.ts
    │   ├── FlightCard.tsx      # Uses shadcn/ui Card, Badge
    │   └── types.ts
    └── settings/
        ├── index.tsx           # Main settings component
        └── components/
            ├── OllamaConnectionTest/
            │   ├── index.tsx
            │   └── hooks/useOllamaConnectionTest.ts
            └── DatabaseConnectionTest/
                ├── index.tsx
                └── hooks/useDatabaseConnectionTest.ts
```

---

## Challenges & Mitigations

| Challenge | Mitigation |
|-----------|------------|
| Google Flights anti-bot detection | Use stealth Playwright settings, random delays, user-agent rotation |
| Long execution times (30-60s) | Implement WebSocket streaming for live progress updates |
| Rate limiting by Google | Add request queuing, random delays, respect robots.txt |
| Dynamic content loading | browser-use handles this automatically |
| Price verification | Cache results in Supabase, implement multi-source validation |
| Container resource usage | Configure memory/CPU limits, use GPU for Ollama |
| Chromium in Docker | Use `shm_size: '2gb'` and proper security settings |

---

## Cost Estimation

### 🎉 Total Monthly Cost: **$0** (Local Infrastructure)

| Service | Cost | Notes |
|---------|------|-------|
| **Next.js** | $0 | Runs in Docker locally |
| **Ollama** | $0 | Local LLM inference |
| **browser-use** | $0 | Local browser automation |
| **Supabase** | $0 | Local PostgreSQL + pgvector |
| **Docker** | $0 | Docker Desktop or Docker Engine |

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **RAM** | 16GB | 32GB |
| **CPU** | 4 cores | 8+ cores |
| **GPU** | None (CPU inference) | NVIDIA GPU (CUDA) for faster Ollama |
| **Disk** | 50GB | 100GB (for models + data) |

### Electricity Cost (Estimated)
- ~$5-15/month depending on usage and hardware

---

## Conclusion

### Feasibility: ✅ YES - Fully Local with Docker

Building this application is **feasible** with a 100% local Docker-based stack:

1. **Ollama with `gpt-oss:20b`** - Local, cost-free LLM inference in Docker
2. **AI SDK 6 with `@ai-sdk/openai-compatible` v2** - Seamless Ollama integration via `createOpenAICompatible()`
3. **Supabase Postgres** - PostgreSQL + pgvector in Docker (v17.x)
4. **browser-use in Docker** - Local browser automation with system Chromium + custom FastAPI wrapper
5. **Next.js in Docker** - Full-stack frontend and API

### Key Success Factors

1. **Docker Compose orchestration** - All services start with one command
2. **Proper error handling** - Browser automation can fail; plan for retries
3. **WebSocket streaming** - Essential for the "wow" live execution view
4. **Local data persistence** - Docker volumes for Ollama models and database
5. **Resource management** - Configure memory/CPU limits appropriately

### Development Commands

```bash
# Start all services with Docker Compose
docker-compose up -d

# Pull the Ollama model (first time only)
docker-compose exec ollama ollama pull gpt-oss:20b

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build

# Access services:
# - Frontend: http://localhost:3000
# - Ollama API: http://localhost:11434
# - Browser-Use API: http://localhost:8000
# - PostgreSQL: http://localhost:5432
```

---

## Alternative Considerations

If browser-use proves challenging, consider these local alternatives:

1. **Puppeteer + AI** - Build custom browser automation in JS (runs in Node.js container)
2. **Playwright directly** - More control over browser automation
3. **Selenium Grid** - Distributed browser automation in Docker

For data sources (if scraping is problematic):

1. **Amadeus API** - GDS flight data access (requires API key but local processing)
2. **Skyscanner API** - Flight search API
3. **Kiwi.com API** - Alternative flight aggregator

These trade off the "AI agent browsing" experience for reliability, while keeping the core application local.
