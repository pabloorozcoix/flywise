import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQuery, mockRelease, mockPoolConnect, mockFetch } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();
  const mockPoolConnect = vi.fn();
  const mockFetch = vi.fn();
  return { mockQuery, mockRelease, mockPoolConnect, mockFetch };
});

vi.mock("pg", () => ({
  Pool: vi.fn(() => ({ connect: mockPoolConnect })),
}));

vi.mock("@/lib/supabase", () => ({
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
}));

global.fetch = mockFetch;

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/system/status", () => {
  it("returns healthy when all services are up", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockPoolConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ version: "PostgreSQL 16.1" }] })
      .mockResolvedValueOnce({ rows: [{ count: 10 }] })
      .mockResolvedValueOnce({ rows: [{ count: 10 }] })
      .mockResolvedValueOnce({ rows: [{ count: 50 }] })
      .mockResolvedValueOnce({ rows: [{ count: 30 }] });

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe("healthy");
    expect(data.services).toHaveLength(3);
  });

  it("returns degraded when browser-use is down", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
    mockPoolConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ version: "PostgreSQL 16.1" }] })
      .mockResolvedValueOnce({ rows: [{ count: 5 }] })
      .mockResolvedValueOnce({ rows: [{ count: 5 }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ count: 10 }] });

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe("degraded");
  });

  it("returns degraded when DB is down", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockPoolConnect.mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe("degraded");
    const pg = data.services.find((s: { name: string }) => s.name === "PostgreSQL");
    expect(pg.status).toBe("unhealthy");
  });

  it("handles table count failure (table doesn't exist)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockPoolConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ version: "PostgreSQL 16.1" }] })
      .mockRejectedValueOnce(new Error("relation does not exist")) // agent_ctx fails
      .mockResolvedValueOnce({ rows: [{ count: 5 }] }) // agent_state
      .mockResolvedValueOnce({ rows: [{ count: 3 }] }) // flight_results
      .mockResolvedValueOnce({ rows: [{ count: 1 }] }); // memory

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe("healthy");
    expect(data.tableCounts.agent_ctx).toBe(-1);
    expect(data.tableCounts.agent_state).toBe(5);
  });

  it("falls back to 'PostgreSQL' when version field is missing", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockPoolConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    mockQuery
      .mockResolvedValueOnce({ rows: [{}] }) // no version field
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] });

    const response = await GET();
    const data = await response.json();

    const pg = data.services.find((s: { name: string }) => s.name === "PostgreSQL");
    expect(pg.status).toBe("healthy");
    expect(pg.details).toBe("PostgreSQL");
  });

  it("falls back to 0 when count is null", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockPoolConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ version: "PostgreSQL 16.1" }] })
      .mockResolvedValueOnce({ rows: [{ count: null }] }) // null count
      .mockResolvedValueOnce({ rows: [{ count: 5 }] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] });

    const response = await GET();
    const data = await response.json();

    expect(data.tableCounts.agent_ctx).toBe(0);
    expect(data.tableCounts.agent_state).toBe(5);
  });

  it("handles non-Error thrown from pool.connect", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockPoolConnect.mockRejectedValue("string error"); // non-Error

    const response = await GET();
    const data = await response.json();

    const pg = data.services.find((s: { name: string }) => s.name === "PostgreSQL");
    expect(pg.status).toBe("unhealthy");
    expect(pg.details).toBe("Unable to connect");
  });

  it("handles non-Error thrown from fetch (checkService)", async () => {
    mockFetch.mockRejectedValueOnce("fetch failed"); // Ollama - non-Error
    mockFetch.mockResolvedValueOnce({ ok: true }); // Browser-Use
    mockPoolConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ version: "PostgreSQL 16.1" }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] });

    const response = await GET();
    const data = await response.json();

    const ollama = data.services.find((s: { name: string }) => s.name === "Ollama");
    expect(ollama.status).toBe("unhealthy");
    expect(ollama.details).toBe("Connection failed");
  });

  it("returns unhealthy with HTTP status when service returns non-ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 }); // Ollama non-ok
    mockFetch.mockResolvedValueOnce({ ok: true }); // Browser-Use ok
    mockPoolConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ version: "PostgreSQL 16.1" }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] });

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe("degraded");
    const ollama = data.services.find((s: { name: string }) => s.name === "Ollama");
    expect(ollama.status).toBe("unhealthy");
    expect(ollama.details).toBe("HTTP 503");
  });
});
