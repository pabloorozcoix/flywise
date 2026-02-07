import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

/**
 * POST /api/verify/:id
 *
 * Stub endpoint for multi-source flight result verification.
 *
 * In production this would:
 *  1. Re-scrape the booking URL to confirm price/availability
 *  2. Cross-reference with airline APIs or aggregator feeds
 *  3. Update the flight_results record with verified = true
 *
 * For now it marks the result as verified in the database and
 * returns a stub response.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing result ID" }, { status: 400 });
  }

  try {
    const now = new Date().toISOString();

    // Mark the flight result as verified
    const result = await pool.query(
      `UPDATE flight_results
       SET verified = TRUE, verified_at = $1
       WHERE id = $2
       RETURNING id, verified, verified_at`,
      [now, id],
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Flight result not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id,
      verified: true,
      verifiedAt: now,
      message:
        "Stub: result marked as verified. Multi-source verification not yet implemented.",
    });
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify flight result" },
      { status: 500 },
    );
  }
}
