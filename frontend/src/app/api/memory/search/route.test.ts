import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockQuery, mockRelease, mockPoolConnect, mockGenerateEmbedding } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();
  const mockPoolConnect = vi.fn();
  const mockGenerateEmbedding = vi.fn().mockResolvedValue([0.1, 0.2, 0.3]);
  return { mockQuery, mockRelease, mockPoolConnect, mockGenerateEmbedding };
});

vi.mock("pg", () => ({
  Pool: vi.fn(() => ({ connect: mockPoolConnect })),
}));

vi.mock("@/lib/supabase", () => ({
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
}));

vi.mock("@/lib/embeddings", () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mockPoolConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
  mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
});

describe("GET /api/memory/search", () => {
  it("returns 400 when q is missing", async () => {
    const request = new NextRequest("http://localhost/api/memory/search");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when q is empty", async () => {
    const request = new NextRequest("http://localhost/api/memory/search?q=");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns 503 when embedding generation fails", async () => {
    mockGenerateEmbedding.mockRejectedValueOnce(new Error("Ollama down"));

    const request = new NextRequest("http://localhost/api/memory/search?q=flights");
    const response = await GET(request);
    expect(response.status).toBe(503);
  });

  it("returns search results on success", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "mem-1", agent_ctx_id: "ctx-1", content: "Flight search JFK→LHR",
        step_number: 1, created_at: "2026-03-14T10:00:00Z", similarity: 0.9234,
        origin: "JFK", destination: "LHR", departure_date: "2026-03-15",
      }],
    });

    const request = new NextRequest("http://localhost/api/memory/search?q=JFK+to+London&limit=5");
    const response = await GET(request);
    const data = await response.json();

    expect(data.query).toBe("JFK to London");
    expect(data.count).toBe(1);
    expect(data.memories[0].similarity).toBe(0.9234);
  });

  it("caps limit at 50", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const request = new NextRequest("http://localhost/api/memory/search?q=test&limit=100");
    await GET(request);

    const queryArgs = mockQuery.mock.calls[0][1];
    expect(queryArgs[1]).toBe(50);
  });

  it("returns searchContext as undefined when origin is null", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "mem-2", agent_ctx_id: "ctx-2", content: "Some memory",
        step_number: 1, created_at: "2026-03-14T10:00:00Z", similarity: 0.85,
        origin: null, destination: null, departure_date: null,
      }],
    });

    const request = new NextRequest("http://localhost/api/memory/search?q=test");
    const response = await GET(request);
    const data = await response.json();

    expect(data.memories[0].searchContext).toBeUndefined();
  });

  it("falls back to 0 when similarity is null", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "mem-3", agent_ctx_id: "ctx-3", content: "No similarity",
        step_number: 1, created_at: "2026-03-14T10:00:00Z", similarity: null,
        origin: "JFK", destination: "LHR", departure_date: "2026-03-15",
      }],
    });

    const request = new NextRequest("http://localhost/api/memory/search?q=test");
    const response = await GET(request);
    const data = await response.json();

    expect(data.memories[0].similarity).toBe(0);
  });

  it("returns 500 on unexpected error (e.g. pool.connect failure)", async () => {
    mockPoolConnect.mockRejectedValueOnce(new Error("DB down"));

    const request = new NextRequest("http://localhost/api/memory/search?q=flights");
    const response = await GET(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("Internal server error");
  });
});
