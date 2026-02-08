import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { DATABASE_URL } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";

const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * Try to parse a value as a valid timestamp.
 * Agent often returns time strings like "6:25 pm" which aren't valid TIMESTAMPTZ.
 * Returns ISO string if parseable, null otherwise.
 */
function tryParseTimestamp(val: unknown): string | null {
  if (!val) return null;
  const str = String(val);
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

/**
 * POST /api/callback/search-complete
 *
 * Callback endpoint invoked by the browser-use service when a search finishes.
 * Persists flight results, updates agent_state, and stores a memory entry
 * summarizing the search for future semantic retrieval.
 *
 * Body:
 *   { search_id, status, results?: FlightResult[], error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { search_id, status, results, error } = body;

    if (!search_id) {
      return NextResponse.json(
        { error: "search_id is required" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // Verify the search exists and get context
      const ctxCheck = await client.query(
        `SELECT id, origin, destination, departure_date, return_date, cabin_class, direct_only
         FROM agent_ctx WHERE id = $1`,
        [search_id]
      );
      if (ctxCheck.rows.length === 0) {
        return NextResponse.json(
          { error: "Search not found" },
          { status: 404 }
        );
      }

      const ctx = ctxCheck.rows[0];

      if (status === "completed" && results && Array.isArray(results)) {
        // Insert each flight result
        for (const result of results) {
          await client.query(
            `INSERT INTO flight_results
              (agent_ctx_id, airline, departure_time, arrival_time, duration, stops, price, currency, flight_url, raw_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              search_id,
              result.airline,
              tryParseTimestamp(result.departure_time),
              tryParseTimestamp(result.arrival_time),
              result.duration || null,
              result.stops ?? 0,
              result.price ?? null,
              result.currency || "USD",
              result.flight_url || null,
              JSON.stringify(result),
            ]
          );
        }

        // Update agent_state to completed
        await client.query(
          `UPDATE agent_state
           SET status = 'completed', completed_at = NOW(), updated_at = NOW()
           WHERE agent_ctx_id = $1`,
          [search_id]
        );

        // Store a memory entry summarizing the search
        const cheapest = results.reduce(
          (min: { price?: number }, r: { price?: number }) =>
            (r.price ?? Infinity) < (min.price ?? Infinity) ? r : min,
          results[0]
        );
        const summary = `Flight search ${ctx.origin} → ${ctx.destination} on ${ctx.departure_date}${ctx.return_date ? ` returning ${ctx.return_date}` : ""} (${ctx.cabin_class}${ctx.direct_only ? ", direct only" : ""}): Found ${results.length} results. Cheapest: ${cheapest?.airline} at ${cheapest?.price} ${cheapest?.currency || "USD"}.`;

        try {
          const embedding = await generateEmbedding(summary);
          const embeddingStr = `[${embedding.join(",")}]`;
          await client.query(
            `INSERT INTO memory (agent_ctx_id, content, embedding, step_number)
             VALUES ($1, $2, $3::vector, $4)`,
            [search_id, summary, embeddingStr, 1]
          );
        } catch (embErr) {
          // Store without embedding if generation fails
          console.warn(
            `[callback/search-complete] Embedding failed, storing without vector:`,
            embErr
          );
          await client.query(
            `INSERT INTO memory (agent_ctx_id, content, step_number)
             VALUES ($1, $2, $3)`,
            [search_id, summary, 1]
          );
        }

        console.log(
          `[callback/search-complete] Persisted ${results.length} results for search ${search_id}`
        );
      } else if (status === "failed") {
        // Update agent_state to failed
        await client.query(
          `UPDATE agent_state
           SET status = 'failed', error_message = $2, updated_at = NOW()
           WHERE agent_ctx_id = $1`,
          [search_id, error || "Unknown error"]
        );

        // Store failure memory
        const failureSummary = `Flight search ${ctx.origin} → ${ctx.destination} on ${ctx.departure_date} failed: ${error || "Unknown error"}`;

        try {
          const embedding = await generateEmbedding(failureSummary);
          const embeddingStr = `[${embedding.join(",")}]`;
          await client.query(
            `INSERT INTO memory (agent_ctx_id, content, embedding, step_number)
             VALUES ($1, $2, $3::vector, $4)`,
            [search_id, failureSummary, embeddingStr, 1]
          );
        } catch {
          await client.query(
            `INSERT INTO memory (agent_ctx_id, content, step_number)
             VALUES ($1, $2, $3)`,
            [search_id, failureSummary, 1]
          );
        }

        console.log(
          `[callback/search-complete] Search ${search_id} failed: ${error}`
        );
      }

      return NextResponse.json({ ok: true });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[callback/search-complete] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
