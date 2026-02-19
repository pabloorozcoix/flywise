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

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mockPoolConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
  mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
});

describe("POST /api/callback/search-complete", () => {
  it("returns 400 when search_id is missing", async () => {
    const request = new NextRequest("http://localhost/api/callback/search-complete", {
      method: "POST",
      body: JSON.stringify({ status: "completed" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 404 when search not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const request = new NextRequest("http://localhost/api/callback/search-complete", {
      method: "POST",
      body: JSON.stringify({ search_id: "nonexist", status: "completed", results: [] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("processes completed search with results", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "s1", origin: "JFK", destination: "LHR", departure_date: "2026-04-10",
          return_date: null, cabin_class: "economy", direct_only: false,
        }],
      })
      .mockResolvedValueOnce({ rows: [] }) // insert flight result
      .mockResolvedValueOnce({ rows: [] }) // update agent_state
      .mockResolvedValueOnce({ rows: [] }); // insert memory

    const request = new NextRequest("http://localhost/api/callback/search-complete", {
      method: "POST",
      body: JSON.stringify({
        search_id: "s1", status: "completed",
        results: [{
          airline: "BA", departure_time: "2026-04-10T08:00:00Z",
          arrival_time: "2026-04-10T20:00:00Z", duration: "7h",
          stops: 0, price: 450, currency: "USD", flight_url: "https://ba.com",
        }],
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });

  it("processes failed search", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "s2", origin: "LAX", destination: "NRT", departure_date: "2026-05-01",
          return_date: null, cabin_class: "business", direct_only: true,
        }],
      })
      .mockResolvedValueOnce({ rows: [] }) // update state
      .mockResolvedValueOnce({ rows: [] }); // insert memory

    const request = new NextRequest("http://localhost/api/callback/search-complete", {
      method: "POST",
      body: JSON.stringify({ search_id: "s2", status: "failed", error: "Agent timeout" }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it("stores failed search memory without embedding when embedding fails", async () => {
    mockGenerateEmbedding.mockRejectedValueOnce(new Error("Ollama down"));

    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "s3", origin: "SFO", destination: "CDG", departure_date: "2026-06-01",
          return_date: null, cabin_class: "economy", direct_only: false,
        }],
      })
      .mockResolvedValueOnce({ rows: [] }) // update state
      .mockResolvedValueOnce({ rows: [] }); // insert memory without embedding

    const request = new NextRequest("http://localhost/api/callback/search-complete", {
      method: "POST",
      body: JSON.stringify({ search_id: "s3", status: "failed", error: "Timeout" }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.ok).toBe(true);

    // The third query should be the fallback insert without embedding
    const thirdCall = mockQuery.mock.calls[2];
    expect(thirdCall[0]).toContain("INSERT INTO memory");
    expect(thirdCall[0]).not.toContain("::vector");
  });

  it("stores completed search memory without embedding when embedding fails", async () => {
    mockGenerateEmbedding.mockRejectedValueOnce(new Error("Ollama down"));

    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "s4", origin: "JFK", destination: "LHR", departure_date: "2026-04-10",
          return_date: "2026-04-20", cabin_class: "economy", direct_only: true,
        }],
      })
      .mockResolvedValueOnce({ rows: [] }) // insert flight result
      .mockResolvedValueOnce({ rows: [] }) // update agent_state
      .mockResolvedValueOnce({ rows: [] }); // insert memory without embedding

    const request = new NextRequest("http://localhost/api/callback/search-complete", {
      method: "POST",
      body: JSON.stringify({
        search_id: "s4", status: "completed",
        results: [{ airline: "BA", price: 500, currency: "USD" }],
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it("returns 500 on unexpected errors (e.g. pool.connect failure)", async () => {
    mockPoolConnect.mockRejectedValueOnce(new Error("DB connection lost"));

    const request = new NextRequest("http://localhost/api/callback/search-complete", {
      method: "POST",
      body: JSON.stringify({ search_id: "s5", status: "completed", results: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("Internal server error");
  });

  it("returns ok for unknown status (neither completed nor failed)", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "s6", origin: "JFK", destination: "LHR", departure_date: "2026-04-10",
        return_date: null, cabin_class: "economy", direct_only: false,
      }],
    });

    const request = new NextRequest("http://localhost/api/callback/search-complete", {
      method: "POST",
      body: JSON.stringify({ search_id: "s6", status: "running" }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });
});
