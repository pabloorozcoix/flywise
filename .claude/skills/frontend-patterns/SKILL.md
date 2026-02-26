---
name: frontend-patterns
description: Architecture, conventions, and code patterns for the Next.js 16 frontend service. Use when working with frontend/ code, understanding TypeScript patterns, or reviewing component architecture.
user-invocable: false
---

# Frontend Service — Patterns & Conventions

## Architecture

Next.js 16 App Router application under `frontend/src/`:

```
src/
├── app/                         # App Router — pages + API routes
│   ├── layout.tsx               #   Root layout (ThemeProvider, Navbar, Footer)
│   ├── page.tsx                 #   Home page — renders <SearchForm />
│   ├── globals.css              #   Tailwind v4 entry + shadcn CSS variables
│   ├── credits/page.tsx         #   Credits page (team + features)
│   ├── history/page.tsx         #   Execution list (ExecutionsTable)
│   ├── history/[id]/page.tsx    #   Live execution timeline (WebSocket)
│   ├── results/page.tsx         #   Redirect → /history (legacy route)
│   ├── results/[id]/page.tsx    #   Flight results (sort/filter)
│   ├── settings/page.tsx        #   Service health dashboard
│   └── api/                     #   16 REST + streaming route handlers
│       ├── ai/ollama-test/      #     Streaming AI test
│       ├── browser-use/health/  #     Proxy to browser-use /health
│       ├── callback/search-complete/ # Callback from browser-use
│       ├── db/test-connection/  #     Database connectivity test
│       ├── db/test-pgvector/    #     pgvector extension test
│       ├── executions/          #     List all search executions
│       ├── executions/[id]/     #     Delete execution + cascade
│       ├── health/              #     Container health check
│       ├── memory/              #     Memory storage + vector search
│       ├── results/[id]/        #     Flight results by search ID
│       ├── search/              #     Initiate flight search
│       ├── search/[id]/cancel/  #     Cancel running search
│       ├── status/[id]/         #     Search status polling
│       ├── system/status/       #     System-wide health
│       └── verify/[id]/         #     Result verification stub
├── components/                  # UI components (directory-per-component)
│   ├── ui/                      #   shadcn/ui primitives (12 components)
│   ├── SearchForm/              #   Flight search form + useFlightSearch hook
│   ├── FlightCard/              #   Flight result card
│   ├── ExecutionTimeline/       #   Real-time agent progress
│   ├── ExecutionsTable/         #   Search execution history data table
│   ├── AgentStatus/             #   Status badge (running/completed/error)
│   ├── Navbar/                  #   App navigation
│   ├── Footer/                  #   App footer
│   ├── settings/                #   Health test components (4 service tests)
│   ├── theme-provider.tsx       #   next-themes wrapper
│   └── theme-toggle.tsx         #   Dark/light mode toggle
├── db/
│   └── schema.ts                # Drizzle ORM schema (pgvector custom type)
└── lib/
    ├── localOllama.ts           # AI SDK createOpenAICompatible provider
    ├── supabase.ts              # Supabase client + DATABASE_URL export
    ├── embeddings.ts            # Ollama vector embedding generation
    ├── utils.ts                 # cn() class merge (shadcn)
    ├── schemas/flightSearch.ts  # Zod validation schemas
    └── types/                   # Shared TypeScript types
        ├── agentEvent.ts        #   WebSocket event types
        ├── flightResult.ts      #   Flight result type
        └── execution.ts         #   Execution row type
```

## Code Conventions

### TypeScript
- Strict mode enabled in `tsconfig.json`
- Explicit types for all function parameters and return values
- `interface` for object shapes (props, API responses)
- Zod schemas for runtime validation of all API inputs
- Named exports only — no default exports

### Component Structure
Every component is a directory:

```
ComponentName/
├── index.ts              # Barrel export (required)
├── ComponentName.tsx     # Implementation (required)
├── types.ts              # TypeScript interfaces (required)
├── constants.ts          # Component-specific constants (optional)
├── styles.ts             # Tailwind class maps (optional)
├── atoms.ts              # Jotai atoms (optional)
└── hooks/
    └── useComponentName.ts  # Custom hooks (optional)
```

### Styling
- Tailwind CSS v4 — CSS-first configuration (no `tailwind.config.ts`)
- `globals.css` uses `@import "tailwindcss"` + `@import "tw-animate-css"`
- Dark mode: `@custom-variant dark (&:where(.dark, .dark *))` in globals.css
- `cn()` utility from `@/lib/utils` for conditional class merging
- shadcn/ui components in `src/components/ui/` — these are owned source files

### State Management
- **Jotai** for shared/global state — atoms, derived atoms, async atoms
- **No React Context** for state management
- **No prop drilling** — use atoms for cross-component state
- `react-hook-form` + `@hookform/resolvers/zod` for form state

### API Routes
- App Router route handlers: `export async function GET/POST(request: NextRequest)`
- Import from `next/server`: `NextRequest`, `NextResponse`
- Validate request bodies with Zod schemas
- Drizzle ORM for server-side database access
- `try/catch` + appropriate HTTP status codes on all handlers
- JSDoc comments describing endpoint purpose

### AI Integration
- AI SDK 6: `streamText()` from `ai` package
- Ollama via `createOpenAICompatible()` from `@ai-sdk/openai-compatible`
- Return streaming: `result.toTextStreamResponse()`
- Never use `ai/rsc` patterns or `createOpenAI` directly

### Database
- Drizzle ORM with `drizzle-orm/pg-core` schema
- Supabase client (`@supabase/supabase-js`) for client-side queries
- Connection: `postgresql://postgres:postgres@supabase-db:5432/postgres` (inside Docker)
- Custom pgvector type defined in `db/schema.ts`

### Imports
- Path aliases: `@/` maps to `src/`
- Components: `import { SearchForm } from "@/components/SearchForm"`
- UI: `import { Button } from "@/components/ui/button"`
- Lib: `import { cn } from "@/lib/utils"`

## Key Dependencies

```
next@16, react@19, typescript@5
ai@^6, @ai-sdk/openai-compatible@^2       # AI SDK
@supabase/supabase-js@^2, drizzle-orm@^0.45, pg@^8  # Database
zod@^4, react-hook-form@^7, @hookform/resolvers@^5   # Validation
jotai@^2                                   # State
next-themes@^0.4                           # Dark mode
tailwindcss@^4, shadcn, tw-animate-css     # Styling
lucide-react@^0.563                        # Icons
@tanstack/react-table@^8                   # Data tables
date-fns@^4, react-day-picker@^9           # Date handling
```

## Build Configuration
- `next.config.ts`: `output: "standalone"` for Docker
- Multi-stage Dockerfile: deps → build → runner (node:22-alpine)
- Dev Dockerfile: single-stage with `next dev` + volume mounts
