import { DATABASE_URL } from "@/lib/supabase";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";

export async function GET() {
  let client: pg.Client | null = null;

  try {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();

    const db = drizzle({ client });

    // Check pgvector extension is enabled
    const extResult = await db.execute(
      sql`SELECT extversion FROM pg_extension WHERE extname = 'vector'`
    );

    if (extResult.rows.length === 0) {
      await client.end();
      return Response.json(
        {
          status: "error",
          error: "pgvector extension is not installed",
        },
        { status: 500 }
      );
    }

    const pgvectorVersion = (extResult.rows[0] as { extversion: string })
      .extversion;

    // Test vector operations: create temp table, insert, query
    await db.execute(sql`
      CREATE TEMP TABLE _pgvector_test (
        id serial PRIMARY KEY,
        embedding vector(3)
      )
    `);

    await db.execute(sql`
      INSERT INTO _pgvector_test (embedding) VALUES ('[1,2,3]'), ('[4,5,6]')
    `);

    const queryResult = await db.execute(sql`
      SELECT id, embedding::text,
             embedding <-> '[1,2,3]'::vector AS distance
      FROM _pgvector_test
      ORDER BY embedding <-> '[1,2,3]'::vector
      LIMIT 1
    `);

    const nearest = queryResult.rows[0] as {
      id: number;
      embedding: string;
      distance: string;
    };

    await db.execute(sql`DROP TABLE _pgvector_test`);
    await client.end();

    return Response.json({
      status: "pgvector_active",
      pgvectorVersion,
      test: {
        nearestId: nearest.id,
        nearestEmbedding: nearest.embedding,
        distance: parseFloat(nearest.distance),
      },
    });
  } catch (error) {
    if (client) {
      try {
        await client.end();
        /* c8 ignore next 2 -- cleanup error is swallowed */
      } catch {
      }
    }

    return Response.json(
      {
        status: "error",
        /* c8 ignore next 4 -- non-Error throws are near-impossible in practice */
        error:
          error instanceof Error
            ? error.message
            : "Unable to test pgvector",
      },
      { status: 500 }
    );
  }
}
