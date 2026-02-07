import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { flightSearchParamsSchema } from "@/lib/schemas/flightSearch";
import { DATABASE_URL } from "@/lib/supabase";

const pool = new Pool({ connectionString: DATABASE_URL });

const BROWSER_USE_URL =
  process.env.BROWSER_USE_API_URL || "http://browser-use:8000";

/**
 * POST /api/search — Initiate a flight search.
 * Validates params, creates DB records, triggers browser-use service, returns search ID.
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
      // Insert into agent_ctx
      const ctxResult = await client.query(
        `INSERT INTO agent_ctx (origin, destination, departure_date, return_date, cabin_class, direct_only)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          params.origin.toUpperCase(),
          params.destination.toUpperCase(),
          params.departureDate,
          params.returnDate || null,
          params.cabinClass,
          params.directOnly,
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
      fetch(`${BROWSER_USE_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: params.origin.toUpperCase(),
          destination: params.destination.toUpperCase(),
          departure_date: params.departureDate,
          return_date: params.returnDate || null,
          cabin_class: params.cabinClass,
          direct_only: params.directOnly,
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            // Persist results
            if (data.results && Array.isArray(data.results)) {
              const insertClient = await pool.connect();
              try {
                for (const result of data.results) {
                  await insertClient.query(
                    `INSERT INTO flight_results (agent_ctx_id, airline, departure_time, arrival_time, duration, stops, price, currency, flight_url, raw_data)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                      searchId,
                      result.airline,
                      result.departure_time,
                      result.arrival_time,
                      result.duration,
                      result.stops,
                      result.price,
                      result.currency || "USD",
                      result.flight_url,
                      JSON.stringify(result),
                    ]
                  );
                }
                // Update agent_state to completed
                await insertClient.query(
                  `UPDATE agent_state SET status = 'completed', completed_at = NOW(), updated_at = NOW()
                   WHERE agent_ctx_id = $1`,
                  [searchId]
                );
              } finally {
                insertClient.release();
              }
            }
          } else {
            // Update agent_state to failed
            const failClient = await pool.connect();
            try {
              await failClient.query(
                `UPDATE agent_state SET status = 'failed', error_message = $2, updated_at = NOW()
                 WHERE agent_ctx_id = $1`,
                [searchId, `Browser-use service returned ${res.status}`]
              );
            } finally {
              failClient.release();
            }
          }
        })
        .catch(async (err) => {
          console.error("[/api/search] browser-use call failed:", err);
          const errClient = await pool.connect();
          try {
            await errClient.query(
              `UPDATE agent_state SET status = 'failed', error_message = $2, updated_at = NOW()
               WHERE agent_ctx_id = $1`,
              [searchId, String(err)]
            );
          } finally {
            errClient.release();
          }
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
