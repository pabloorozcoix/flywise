import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { DATABASE_URL } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";

const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * POST /api/memory — Store an agent step summary with embedding in the memory table.
 *
 * Body:
 *   { agent_ctx_id: string, content: string, step_number?: number }
 *
 * Generates an embedding via Ollama and stores the text + embedding for
 * future semantic similarity retrieval.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_ctx_id, content, step_number } = body;

    if (!agent_ctx_id || !content) {
      return NextResponse.json(
        { error: "agent_ctx_id and content are required" },
        { status: 400 }
      );
    }

    // Generate embedding for the content
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(content);
    } catch (err) {
      console.warn("[/api/memory] Failed to generate embedding:", err);
      // Store without embedding — can be backfilled later
    }

    const client = await pool.connect();
    try {
      const embeddingStr = embedding
        ? `[${embedding.join(",")}]`
        : null;

      const result = await client.query(
        `INSERT INTO memory (agent_ctx_id, content, embedding, step_number)
         VALUES ($1, $2, $3::vector, $4)
         RETURNING id`,
        [agent_ctx_id, content, embeddingStr, step_number ?? null]
      );

      return NextResponse.json({
        id: result.rows[0].id,
        hasEmbedding: embedding !== null,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[/api/memory] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
