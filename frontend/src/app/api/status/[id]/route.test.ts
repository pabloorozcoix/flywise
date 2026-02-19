import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockQuery, mockRelease, mockPoolConnect } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();
  const mockPoolConnect = vi.fn();
  return { mockQuery, mockRelease, mockPoolConnect };
});

vi.mock("pg", () => ({
  Pool: vi.fn(() => ({ connect: mockPoolConnect })),
}));

vi.mock("@/lib/supabase", () => ({
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mockPoolConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
});

describe("GET /api/status/[id]", () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it("returns 404 when search not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const request = new NextRequest("http://localhost/api/status/unknown");
    const response = await GET(request, makeParams("unknown"));
    expect(response.status).toBe(404);
  });

  it("returns running status without results", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ status: "running", error_message: null, started_at: "2026-03-15T10:00:00Z", completed_at: null }],
    });

    const request = new NextRequest("http://localhost/api/status/s1");
    const response = await GET(request, makeParams("s1"));
    const data = await response.json();

    expect(data.status).toBe("running");
    expect(data.results).toEqual([]);
  });

  it("returns completed status with results", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ status: "completed", error_message: null, started_at: "2026-03-15T10:00:00Z", completed_at: "2026-03-15T10:05:00Z" }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "r1", airline: "BA", departure_time: "2026-04-10T08:00:00Z", arrival_time: "2026-04-10T20:00:00Z", duration: "7h", stops: 0, price: "450.00", currency: "USD", flight_url: "https://ba.com" }],
      });

    const request = new NextRequest("http://localhost/api/status/s1");
    const response = await GET(request, makeParams("s1"));
    const data = await response.json();

    expect(data.status).toBe("completed");
    expect(data.results).toHaveLength(1);
  });

  it("returns failed status with error", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ status: "failed", error_message: "Agent timeout", started_at: "2026-03-15T10:00:00Z", completed_at: null }],
    });

    const request = new NextRequest("http://localhost/api/status/s1");
    const response = await GET(request, makeParams("s1"));
    const data = await response.json();

    expect(data.status).toBe("failed");
    expect(data.error).toBe("Agent timeout");
  });

  it("returns 500 on unexpected error (e.g. pool.connect failure)", async () => {
    mockPoolConnect.mockRejectedValueOnce(new Error("DB down"));

    const request = new NextRequest("http://localhost/api/status/s1");
    const response = await GET(request, makeParams("s1"));
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("Internal server error");
  });
});
