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
    const result = await db.execute(sql`SELECT version()`);
    const version = (result.rows[0] as { version: string }).version;

    await client.end();

    return Response.json({
      status: "connected",
      version,
    });
  } catch (error) {
    if (client) {
      try {
        await client.end();
      } catch {
        // ignore cleanup errors
      }
    }

    return Response.json(
      {
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to connect to database",
      },
      { status: 500 }
    );
  }
}
