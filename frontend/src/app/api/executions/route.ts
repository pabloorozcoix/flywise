import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { DATABASE_URL } from "@/lib/supabase";

const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * GET /api/executions — List all search executions (agent_ctx + agent_state + result count).
 * Returns execution data for the executions table view.
 */
export async function GET(_request: NextRequest) {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT
          c.id AS search_id,
          c.origin,
          c.destination,
          c.departure_date::text AS departure_date,
          c.return_date::text AS return_date,
          c.cabin_class,
          c.direct_only,
          c.created_at AS created_at,
          s.status,
          s.error_message,
          s.started_at,
          s.completed_at,
          (SELECT COUNT(*)::int FROM flight_results fr WHERE fr.agent_ctx_id = c.id) AS result_count
         FROM agent_ctx c
         LEFT JOIN LATERAL (
           SELECT status, error_message, started_at, completed_at
           FROM agent_state
           WHERE agent_ctx_id = c.id
           ORDER BY created_at DESC
           LIMIT 1
         ) s ON true
         ORDER BY c.created_at DESC`
      );

      const executions = result.rows.map((row) => ({
        searchId: row.search_id,
        origin: row.origin,
        destination: row.destination,
        departureDate: row.departure_date,
        returnDate: row.return_date,
        cabinClass: row.cabin_class,
        directOnly: row.direct_only ?? false,
        createdAt: row.created_at?.toISOString() ?? null,
        status: row.status ?? "pending",
        errorMessage: row.error_message ?? null,
        startedAt: row.started_at?.toISOString() ?? null,
        completedAt: row.completed_at?.toISOString() ?? null,
        resultCount: row.result_count ?? 0,
      }));

      return NextResponse.json({ executions });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[/api/executions] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
