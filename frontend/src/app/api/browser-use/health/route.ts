import { NextResponse } from "next/server";

const BROWSER_USE_URL =
  process.env.BROWSER_USE_API_URL || "http://browser-use:8000";

/**
 * GET /api/browser-use/health — Proxy health check to browser-use service.
 */
export async function GET() {
  try {
    const response = await fetch(`${BROWSER_USE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { status: "error", error: `Browser-use returned ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      status: "ok",
      serviceStatus: data.status,
      url: BROWSER_USE_URL,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        /* c8 ignore next 4 -- non-Error throws are near-impossible in practice */
        error:
          error instanceof Error
            ? error.message
            : "Unable to connect to browser-use service",
      },
      { status: 503 }
    );
  }
}
