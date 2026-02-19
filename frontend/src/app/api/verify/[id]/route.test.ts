import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockQuery } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery };
});

vi.mock("pg", () => ({
  Pool: vi.fn(() => ({ query: mockQuery })),
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/verify/[id]", () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it("returns verified result on success", async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: "fr-1", verified: true, verified_at: "2026-03-15T12:00:00Z" }],
    });

    const request = new NextRequest("http://localhost/api/verify/fr-1", { method: "POST" });
    const response = await POST(request, makeParams("fr-1"));
    const data = await response.json();

    expect(data.verified).toBe(true);
    expect(data.message).toContain("Stub");
  });

  it("returns 404 when flight result not found", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const request = new NextRequest("http://localhost/api/verify/nonexist", { method: "POST" });
    const response = await POST(request, makeParams("nonexist"));
    expect(response.status).toBe(404);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB failure"));

    const request = new NextRequest("http://localhost/api/verify/fr-1", { method: "POST" });
    const response = await POST(request, makeParams("fr-1"));
    expect(response.status).toBe(500);
  });

  it("returns 400 when id is empty", async () => {
    const request = new NextRequest("http://localhost/api/verify/", { method: "POST" });
    const response = await POST(request, makeParams(""));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Missing result ID");
  });
});
