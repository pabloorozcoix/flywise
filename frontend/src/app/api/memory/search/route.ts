import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { DATABASE_URL } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";

const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * GET /api/memory/search?q=...&limit=10
 *
 * Semantic similarity search over agent memory.
 * Generates an embedding for the query text and finds the most
 * similar memories using cosine distance (pgvector <=> operator).
 *
 * Query params:
 *   q     - The text to search for (required)
 *   limit - Max results to return (default: 10)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "10", 10),
      50
    );

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    // Generate embedding for the query text
    let queryEmbedding: number[];
    try {
      queryEmbedding = await generateEmbedding(query);
    } catch (err) {
      console.error("[/api/memory/search] Failed to generate query embedding:", err);
      return NextResponse.json(
        { error: "Failed to generate embedding for query. Is Ollama running?" },
        { status: 503 }
      );
    }

    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    const client = await pool.connect();
    try {
      // Cosine similarity search using pgvector <=> operator
      // Lower distance = more similar; cosine distance = 1 - cosine_similarity
      const result = await client.query(
        `SELECT
           m.id,
           m.agent_ctx_id,
           m.content,
           m.step_number,
           m.created_at,
           1 - (m.embedding <=> $1::vector) AS similarity,
           c.origin,
           c.destination,
           c.departure_date
         FROM memory m
         LEFT JOIN agent_ctx c ON c.id = m.agent_ctx_id
         WHERE m.embedding IS NOT NULL
         ORDER BY m.embedding <=> $1::vector
         LIMIT $2`,
        [embeddingStr, limit]
      );

      const memories = result.rows.map((row) => ({
        id: row.id,
        agentCtxId: row.agent_ctx_id,
        content: row.content,
        stepNumber: row.step_number,
        similarity: parseFloat(row.similarity?.toFixed(4) ?? "0"),
        createdAt: row.created_at,
        searchContext: row.origin
          ? {
              origin: row.origin,
              destination: row.destination,
              departureDate: row.departure_date,
            }
          : undefined,
      }));

      return NextResponse.json({
        query,
        count: memories.length,
        memories,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[/api/memory/search] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
