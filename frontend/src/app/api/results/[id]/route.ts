import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { DATABASE_URL } from "@/lib/supabase";

const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * GET /api/results/[id] — Fetch flight results for a completed search.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: searchId } = await params;

    const client = await pool.connect();
    try {
      // Get search context
      const ctxResult = await client.query(
        `SELECT id, origin, destination, departure_date, return_date, cabin_class, direct_only, llm_provider, llm_model
         FROM agent_ctx WHERE id = $1`,
        [searchId]
      );

      if (ctxResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Search not found" },
          { status: 404 }
        );
      }

      const ctx = ctxResult.rows[0];

      // Get agent state
      const stateResult = await client.query(
        `SELECT status, error_message FROM agent_state WHERE agent_ctx_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [searchId]
      );

      const state = stateResult.rows[0];

      // Get flight results
      const resultsResult = await client.query(
        `SELECT id, airline, departure_time, arrival_time, duration, stops, price, currency, flight_url, raw_data
         FROM flight_results
         WHERE agent_ctx_id = $1
         ORDER BY price ASC NULLS LAST`,
        [searchId]
      );

      const results = resultsResult.rows.map((r) => {
        // Fall back to raw_data JSONB for time fields when TIMESTAMPTZ is null
        const raw = typeof r.raw_data === "string" ? JSON.parse(r.raw_data) : r.raw_data || {};
        return {
          id: r.id,
          searchId,
          airline: r.airline,
          departure: r.departure_time?.toISOString() || raw.departure_time || "",
          arrival: r.arrival_time?.toISOString() || raw.arrival_time || "",
          duration: r.duration || raw.duration || "",
          stops: r.stops ?? raw.stops ?? 0,
          price: r.price ? parseFloat(r.price) : (raw.price ?? 0),
          currency: r.currency || raw.currency || "USD",
          url: r.flight_url || raw.flight_url || null,
          origin: ctx.origin,
          destination: ctx.destination,
          cabinClass: ctx.cabin_class,
        };
      });

      return NextResponse.json({
        searchId,
        status: state?.status || "unknown",
        error: state?.error_message,
        searchParams: {
          origin: ctx.origin,
          destination: ctx.destination,
          departureDate: ctx.departure_date,
          returnDate: ctx.return_date,
          cabinClass: ctx.cabin_class,
          directOnly: ctx.direct_only,
        },
        llm: {
          provider: ctx.llm_provider || "ollama",
          model: ctx.llm_model || "qwen3:8b",
        },
        results,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[/api/results] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
