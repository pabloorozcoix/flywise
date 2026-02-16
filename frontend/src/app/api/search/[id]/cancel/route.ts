import { NextRequest, NextResponse } from "next/server";

const BROWSER_USE_URL =
  process.env.BROWSER_USE_API_URL || "http://browser-use:8000";

/**
 * POST /api/search/[id]/cancel — Cancel/terminate a running search.
 * Proxies to browser-use POST /search/{id}/cancel.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: searchId } = await params;

  try {
    const res = await fetch(`${BROWSER_USE_URL}/search/${searchId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cancel search";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
