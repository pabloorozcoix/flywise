import { NextResponse } from "next/server";

/**
 * GET /api/health — Simple health check for the Next.js app.
 * Used by Docker healthcheck and load balancers.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
