import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { DATABASE_URL } from "@/lib/supabase";

const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * GET /api/status/[id] — Polling fallback for search execution status.
 * Returns the current status and results for a search when WebSocket is unavailable.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: searchId } = await params;

    const client = await pool.connect();
    try {
      // Get agent state
      const stateResult = await client.query(
        `SELECT s.status, s.error_message, s.started_at, s.completed_at
         FROM agent_state s
         WHERE s.agent_ctx_id = $1
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [searchId]
      );

      if (stateResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Search not found" },
          { status: 404 }
        );
      }

      const state = stateResult.rows[0];

      // Get results if completed
      let results: Record<string, unknown>[] = [];
      if (state.status === "completed") {
        const resultsResult = await client.query(
          `SELECT id, airline, departure_time, arrival_time, duration, stops, price, currency, flight_url
           FROM flight_results
           WHERE agent_ctx_id = $1
           ORDER BY price ASC NULLS LAST`,
          [searchId]
        );
        results = resultsResult.rows.map((r) => ({
          id: r.id,
          airline: r.airline,
          departureTime: r.departure_time,
          arrivalTime: r.arrival_time,
          duration: r.duration,
          stops: r.stops,
          price: parseFloat(r.price),
          currency: r.currency,
          flightUrl: r.flight_url,
        }));
      }

      return NextResponse.json({
        searchId,
        status: state.status,
        error: state.error_message || undefined,
        startedAt: state.started_at,
        completedAt: state.completed_at,
        results,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[/api/status] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
