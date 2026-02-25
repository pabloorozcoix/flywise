import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { DATABASE_URL } from "@/lib/supabase";

const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * DELETE /api/executions/[id] — Delete a search execution and all related data.
 * Cascade deletes agent_state, memory, and flight_results via FK constraints.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "DELETE FROM agent_ctx WHERE id = $1 RETURNING id",
        [id]
      );

      if (result.rowCount === 0) {
        return NextResponse.json(
          { error: "Execution not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ deleted: id });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`[/api/executions/${id}] DELETE error:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
