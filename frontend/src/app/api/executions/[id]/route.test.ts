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

import { DELETE } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mockPoolConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
});

describe("DELETE /api/executions/[id]", () => {
  const makeRequest = (id: string) =>
    new NextRequest(`http://localhost/api/executions/${id}`, { method: "DELETE" });

  const makeParams = (id: string) => Promise.resolve({ id });

  it("returns 400 when id is empty", async () => {
    const response = await DELETE(makeRequest(""), { params: makeParams("") });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing id parameter");
  });

  it("deletes execution and returns deleted id", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "abc-123" }] });

    const response = await DELETE(makeRequest("abc-123"), { params: makeParams("abc-123") });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.deleted).toBe("abc-123");
    expect(mockQuery).toHaveBeenCalledWith(
      "DELETE FROM agent_ctx WHERE id = $1 RETURNING id",
      ["abc-123"]
    );
  });

  it("returns 404 when execution is not found", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const response = await DELETE(makeRequest("nonexistent"), { params: makeParams("nonexistent") });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Execution not found");
  });

  it("releases the client after successful delete", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "abc-123" }] });

    await DELETE(makeRequest("abc-123"), { params: makeParams("abc-123") });

    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("releases the client after not-found response", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await DELETE(makeRequest("nonexistent"), { params: makeParams("nonexistent") });

    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when pool.connect throws", async () => {
    mockPoolConnect.mockRejectedValueOnce(new Error("Connection refused"));

    const response = await DELETE(makeRequest("abc-123"), { params: makeParams("abc-123") });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("returns 500 when query throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Syntax error"));

    const response = await DELETE(makeRequest("abc-123"), { params: makeParams("abc-123") });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("releases the client even when query throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Query failed"));

    await DELETE(makeRequest("abc-123"), { params: makeParams("abc-123") });

    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});
