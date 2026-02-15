import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { flightSearchParamsSchema } from "@/lib/schemas/flightSearch";
import { DATABASE_URL } from "@/lib/supabase";

const pool = new Pool({ connectionString: DATABASE_URL });

const BROWSER_USE_URL =
  process.env.BROWSER_USE_API_URL || "http://browser-use:8000";

/** Server-side OpenAI API key fallback (from env) */
const OPENAI_API_KEY_ENV = process.env.OPENAI_API_KEY || "";

/** Cache TTL in minutes — identical searches within this window return cached results */
const CACHE_TTL_MINUTES = parseInt(
  process.env.CACHE_TTL_MINUTES || "60",
  10
);

/**
 * POST /api/search — Initiate a flight search.
 * 1. Validates params
 * 2. Checks for cached results within CACHE_TTL_MINUTES
 * 3. If cache hit → returns existing searchId + "completed"
 * 4. If cache miss → creates DB records, triggers browser-use, returns "running"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = flightSearchParamsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search parameters", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const params = parsed.data;
    const client = await pool.connect();

    try {
      // ── Cache lookup ──────────────────────────────────────────────
      // Skip cache when an OpenAI key is provided (different model → different results)
      let cacheResult = { rows: [] as { id: string }[] };

      if (!params.openaiApiKey) {
        cacheResult = await client.query(
          `SELECT c.id
           FROM agent_ctx c
           JOIN agent_state s ON s.agent_ctx_id = c.id
           WHERE c.origin      = $1
             AND c.destination  = $2
             AND c.departure_date = $3
             AND COALESCE(c.return_date::text, '') = COALESCE($4::text, '')
             AND c.cabin_class  = $5
             AND c.direct_only  = $6
             AND s.status       = 'completed'
             AND c.created_at   > NOW() - INTERVAL '1 minute' * $7
             AND EXISTS (
               SELECT 1 FROM flight_results fr WHERE fr.agent_ctx_id = c.id
             )
           ORDER BY c.created_at DESC
           LIMIT 1`,
          [
            params.origin.toUpperCase(),
            params.destination.toUpperCase(),
            params.departureDate,
            params.returnDate || null,
            params.cabinClass,
            params.directOnly,
            CACHE_TTL_MINUTES,
          ]
        );
      }

      if (cacheResult.rows.length > 0) {
        const cachedId = cacheResult.rows[0].id;
        console.log(`[/api/search] Cache hit for search ${cachedId}`);
        return NextResponse.json({
          searchId: cachedId,
          status: "completed",
          cached: true,
        });
      }

      // ── No cache — create new search ──────────────────────────────
      // Determine effective OpenAI key: per-request key takes priority, then env var
      const effectiveOpenaiKey = params.openaiApiKey || OPENAI_API_KEY_ENV;

      // Determine which LLM provider/model will be used
      const effectiveProvider = effectiveOpenaiKey ? "openai" : "ollama";
      const effectiveModel = effectiveOpenaiKey ? "gpt-4.1-mini" : "qwen3:8b";

      const ctxResult = await client.query(
        `INSERT INTO agent_ctx (origin, destination, departure_date, return_date, cabin_class, direct_only, llm_provider, llm_model)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          params.origin.toUpperCase(),
          params.destination.toUpperCase(),
          params.departureDate,
          params.returnDate || null,
          params.cabinClass,
          params.directOnly,
          effectiveProvider,
          effectiveModel,
        ]
      );

      const searchId = ctxResult.rows[0].id;

      // Insert into agent_state with status "running"
      await client.query(
        `INSERT INTO agent_state (agent_ctx_id, status, started_at)
         VALUES ($1, 'running', NOW())`,
        [searchId]
      );

      // Fire-and-forget: trigger browser-use service
      // The browser-use service accepts the search and processes it in the background.
      // It will call /api/callback/search-complete with results when done.

      fetch(`${BROWSER_USE_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000), // 15s to accept the request
        body: JSON.stringify({
          search_id: searchId,
          origin: params.origin.toUpperCase(),
          destination: params.destination.toUpperCase(),
          departure_date: params.departureDate,
          return_date: params.returnDate || null,
          cabin_class: params.cabinClass,
          direct_only: params.directOnly,
          ...(effectiveOpenaiKey ? { openai_api_key: effectiveOpenaiKey } : {}),
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text().catch(() => "unknown error");
            throw new Error(`browser-use returned ${res.status}: ${text}`);
          }
          console.log(`[/api/search] browser-use accepted search ${searchId}`);
        })
        .catch((err) => {
          // Only mark as failed for non-timeout errors.
          // Timeout just means the request took long to accept, but the search
          // may still be running on the browser-use side.
          if (err?.name === "TimeoutError" || err?.name === "AbortError") {
            console.warn(
              `[/api/search] browser-use accept timed out for ${searchId} — search may still be running`
            );
            return;
          }
          console.error("[/api/search] browser-use call failed:", err);
          pool
            .connect()
            .then((errClient) => {
              errClient
                .query(
                  `UPDATE agent_state SET status = 'failed', error_message = $2, updated_at = NOW()
                   WHERE agent_ctx_id = $1 AND status = 'running'`,
                  [searchId, err instanceof Error ? err.message : String(err)]
                )
                .finally(() => errClient.release());
            })
            .catch(() => {});
        });

      return NextResponse.json({
        searchId,
        status: "running",
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[/api/search] error:", error);

    // Return user-friendly error messages based on error type
    const message =
      error instanceof SyntaxError
        ? "Invalid request body"
        : error instanceof Error && error.message.includes("ECONNREFUSED")
          ? "Database is unavailable. Please try again later."
          : "Internal server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
