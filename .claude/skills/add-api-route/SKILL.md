---
name: add-api-route
description: Create a new Next.js App Router API route following project conventions. Use when adding a new backend endpoint to the frontend service.
argument-hint: "[route-path e.g. api/search or api/db/test-connection]"
---

Create a new Next.js API route at `frontend/src/app/$ARGUMENTS/route.ts`.

## Conventions

- Use Next.js App Router route handlers (`export async function GET/POST/PUT/DELETE`)
- Import types from `next/server` (`NextRequest`, `NextResponse`)
- Validate request bodies with Zod schemas
- Use Drizzle ORM for database access (import from `@/db/schema`)
- Use `@/lib/localOllama` for Ollama integration with `createOpenAICompatible`
- Use `@/lib/supabase` for Supabase client access
- Return `NextResponse.json()` for JSON responses
- Use `streamText().toTextStreamResponse()` for streaming responses
- Wrap all handlers in try/catch, return appropriate HTTP status codes
- Add JSDoc comment describing the endpoint purpose

## Template

```typescript
import { NextRequest, NextResponse } from "next/server";

/**
 * [DESCRIPTION]
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

## After creating

1. Verify TypeScript compiles without errors
2. If the route connects to external services, use Docker service names (not localhost)
3. Add the route to the relevant API section in documentation if applicable
