---
name: add-api-route
description: Create a new Next.js App Router API route following project conventions. Use when adding a new backend endpoint to the frontend service.
argument-hint: "[route-path e.g. api/search or api/db/test-connection]"
---

Create a new Next.js API route at `frontend/src/app/$ARGUMENTS/route.ts`.

## Existing API Routes

```
frontend/src/app/api/
├── ai/ollama-test/route.ts          # GET — streaming AI test
├── browser-use/health/route.ts      # GET — proxy to browser-use /health
├── callback/search-complete/route.ts # POST — callback from browser-use
├── db/test-connection/route.ts      # GET — database connectivity test
├── db/test-pgvector/route.ts        # GET — pgvector extension test
├── executions/route.ts              # GET — list all search executions
├── executions/[id]/route.ts         # DELETE — delete execution + cascade
├── health/route.ts                  # GET — container health check
├── memory/route.ts                  # POST — store memory with embedding
├── memory/search/route.ts           # GET — vector similarity search
├── results/[id]/route.ts            # GET — flight results by search ID
├── search/route.ts                  # POST — initiate flight search
├── search/[id]/cancel/route.ts      # POST — cancel running search
├── status/[id]/route.ts             # GET — search status polling
├── system/status/route.ts           # GET — system-wide health
└── verify/[id]/route.ts             # POST — result verification stub
```

## Conventions

- Use Next.js App Router route handlers (`export async function GET/POST/PUT/DELETE`)
- Import types from `next/server` (`NextRequest`, `NextResponse`)
- Validate request bodies with Zod schemas from `@/lib/schemas/flightSearch`
- Use Drizzle ORM for database access (import from `@/db/schema`)
- Use `@/lib/localOllama` for Ollama integration with `createOpenAICompatible`
- Use `@/lib/supabase` for Supabase client access
- Use `@/lib/embeddings` for vector embedding generation
- Return `NextResponse.json()` for JSON responses
- Use `streamText().toTextStreamResponse()` for streaming responses
- Wrap all handlers in try/catch, return appropriate HTTP status codes
- Add JSDoc comment describing the endpoint purpose
- Use Docker service names for inter-service URLs (not localhost)

## Template

```typescript
import { NextRequest, NextResponse } from "next/server";

/**
 * [DESCRIPTION] — [HTTP_METHOD] /api/[ROUTE_PATH]
 */
export async function GET(request: NextRequest) {
  try {
    // Implementation
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[ROUTE_NAME] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

## Dynamic Route Template

For routes with parameters like `[id]`:

```typescript
import { NextRequest, NextResponse } from "next/server";

/**
 * [DESCRIPTION] — GET /api/[parent]/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Use id for database queries
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error(`[ROUTE_NAME] error for ${id}:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

## After Creating

1. Verify TypeScript compiles without errors
2. If the route connects to external services, use Docker service names (not localhost):
   - Ollama: `http://ollama:11434`
   - browser-use: `http://browser-use:8000`
   - PostgreSQL: `postgresql://postgres:postgres@supabase-db:5432/postgres`
3. Test via `curl http://localhost:3000/api/[route-path]`
