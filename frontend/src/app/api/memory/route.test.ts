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

describe("POST /api/memory", () => {
  it("returns 400 when agent_ctx_id is missing", async () => {
    const request = new NextRequest("http://localhost/api/memory", {
      method: "POST",
      body: JSON.stringify({ content: "test" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when content is missing", async () => {
    const request = new NextRequest("http://localhost/api/memory", {
      method: "POST",
      body: JSON.stringify({ agent_ctx_id: "ctx-1" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("stores memory with embedding on success", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "mem-1" }] });

    const request = new NextRequest("http://localhost/api/memory", {
      method: "POST",
      body: JSON.stringify({ agent_ctx_id: "ctx-1", content: "Found 5 flights", step_number: 1 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.id).toBe("mem-1");
    expect(data.hasEmbedding).toBe(true);
  });

  it("stores memory without embedding when generation fails", async () => {
    mockGenerateEmbedding.mockRejectedValueOnce(new Error("Ollama down"));
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "mem-2" }] });

    const request = new NextRequest("http://localhost/api/memory", {
      method: "POST",
      body: JSON.stringify({ agent_ctx_id: "ctx-1", content: "Some content" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.id).toBe("mem-2");
    expect(data.hasEmbedding).toBe(false);
  });

  it("returns 500 on unexpected error (e.g. pool.connect failure)", async () => {
    mockPoolConnect.mockRejectedValueOnce(new Error("DB down"));

    const request = new NextRequest("http://localhost/api/memory", {
      method: "POST",
      body: JSON.stringify({ agent_ctx_id: "ctx-1", content: "Some content" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("Internal server error");
  });
});
