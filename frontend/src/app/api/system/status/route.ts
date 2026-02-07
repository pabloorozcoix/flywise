import { NextResponse } from "next/server";
import { Pool } from "pg";
import { DATABASE_URL } from "@/lib/supabase";

const pool = new Pool({ connectionString: DATABASE_URL });

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://ollama:11434";
const BROWSER_USE_URL =
  process.env.BROWSER_USE_API_URL || "http://browser-use:8000";

interface ServiceStatus {
  name: string;
  status: "healthy" | "unhealthy" | "unknown";
  latencyMs?: number;
  details?: string;
}

/**
 * GET /api/system/status — Aggregate health check for all services.
 * Returns status for Ollama, Browser-Use, PostgreSQL, and table row counts.
 */
export async function GET() {
  const services: ServiceStatus[] = [];

  // Check Ollama
  const ollamaStatus = await checkService("Ollama", `${OLLAMA_HOST}/api/tags`);
  services.push(ollamaStatus);

  // Check Browser-Use
  const browserUseStatus = await checkService(
    "Browser-Use",
    `${BROWSER_USE_URL}/health`
  );
  services.push(browserUseStatus);

  // Check PostgreSQL + get table counts
  const tableCounts: Record<string, number> = {};
  try {
    const start = Date.now();
    const client = await pool.connect();
    const latencyMs = Date.now() - start;
    try {
      const versionResult = await client.query("SELECT version()");
      const version = versionResult.rows[0]?.version?.split(" ").slice(0, 2).join(" ") || "PostgreSQL";

      // Get row counts for all application tables
      const countQueries = ["agent_ctx", "agent_state", "flight_results", "memory"];
      for (const table of countQueries) {
        try {
          const countResult = await client.query(
            `SELECT COUNT(*)::int as count FROM ${table}`
          );
          tableCounts[table] = countResult.rows[0]?.count ?? 0;
        } catch {
          tableCounts[table] = -1; // table doesn't exist
        }
      }

      services.push({
        name: "PostgreSQL",
        status: "healthy",
        latencyMs,
        details: version,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    services.push({
      name: "PostgreSQL",
      status: "unhealthy",
      details:
        error instanceof Error ? error.message : "Unable to connect",
    });
  }

  const allHealthy = services.every((s) => s.status === "healthy");

  return NextResponse.json({
    status: allHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    services,
    tableCounts,
  });
}

async function checkService(
  name: string,
  url: string
): Promise<ServiceStatus> {
  try {
    const start = Date.now();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;

    if (response.ok) {
      return { name, status: "healthy", latencyMs };
    }
    return {
      name,
      status: "unhealthy",
      latencyMs,
      details: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name,
      status: "unhealthy",
      details:
        error instanceof Error ? error.message : "Connection failed",
    };
  }
}
