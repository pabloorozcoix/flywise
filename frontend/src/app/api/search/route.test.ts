import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockQuery, mockRelease, mockPoolConnect, mockFetch } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();
  const mockPoolConnect = vi.fn().mockResolvedValue({
    query: mockQuery,
    release: mockRelease,
  });
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

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mockPoolConnect.mockResolvedValue({
    query: mockQuery,
    release: mockRelease,
  });
  mockFetch.mockResolvedValue({ ok: true, text: async () => "ok" });
});

describe("POST /api/search", () => {
  it("returns 400 for invalid params", async () => {
    const request = new NextRequest("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({ origin: "", destination: "LHR" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("Invalid search parameters");
  });

  it("returns cached result when cache hit", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "cached-id" }] });

    const request = new NextRequest("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        origin: "JFK",
        destination: "LHR",
        departureDate: "2026-04-10",
        cabinClass: "economy",
        directOnly: false,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.searchId).toBe("cached-id");
    expect(data.status).toBe("completed");
    expect(data.cached).toBe(true);
  });

  it("creates new search when no cache hit", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "new-search-id" }] })
      .mockResolvedValueOnce({ rows: [] });

    const request = new NextRequest("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        origin: "JFK",
        destination: "LHR",
        departureDate: "2026-04-10",
        cabinClass: "economy",
        directOnly: false,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.searchId).toBe("new-search-id");
    expect(data.status).toBe("running");
  });

  it("skips cache when openaiApiKey is provided", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "openai-search" }] })
      .mockResolvedValueOnce({ rows: [] });

    const request = new NextRequest("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        origin: "SFO",
        destination: "CDG",
        departureDate: "2026-06-20",
        cabinClass: "first",
        directOnly: false,
        openaiApiKey: "sk-test-1234567890abcdef",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.searchId).toBe("openai-search");
    expect(data.status).toBe("running");
  });

  it("returns 500 on DB connection failure", async () => {
    mockPoolConnect.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const request = new NextRequest("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        origin: "JFK",
        destination: "LHR",
        departureDate: "2026-04-10",
        cabinClass: "economy",
        directOnly: false,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("Database is unavailable. Please try again later.");
  });

  it("returns 'Invalid request body' on SyntaxError", async () => {
    // Simulate a malformed JSON body that causes a SyntaxError
    const request = new NextRequest("http://localhost/api/search", {
      method: "POST",
      body: "not-valid-json{{{",
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("Invalid request body");
  });

  it("returns 'Internal server error' for generic errors", async () => {
    mockPoolConnect.mockRejectedValueOnce(new Error("Something unexpected"));

    const request = new NextRequest("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        origin: "JFK",
        destination: "LHR",
        departureDate: "2026-04-10",
        cabinClass: "economy",
        directOnly: false,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("Internal server error");
  });

  it("handles browser-use timeout error gracefully (AbortError)", async () => {
    // Create a controllable promise for the fire-and-forget fetch
    let fetchReject: (err: Error) => void;
    const fetchPromise = new Promise<Response>((_resolve, reject) => {
      fetchReject = reject;
    });

    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // cache miss
      .mockResolvedValueOnce({ rows: [{ id: "timeout-search" }] }) // insert ctx
      .mockResolvedValueOnce({ rows: [] }); // insert state

    mockFetch.mockReturnValueOnce(fetchPromise);

    const request = new NextRequest("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        origin: "JFK",
        destination: "LHR",
        departureDate: "2026-04-10",
        cabinClass: "economy",
        directOnly: false,
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.status).toBe("running");

    // Now simulate the timeout error — should NOT trigger DB update
    const timeoutError = new Error("Timeout");
    timeoutError.name = "TimeoutError";
    fetchReject!(timeoutError);

    // Let microtasks run
    await new Promise((r) => setTimeout(r, 50));

    // mockQuery should NOT have been called again for the status update
    // (3 calls: cache check, insert ctx, insert state)
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it("handles browser-use network error and marks search as failed", async () => {
    // Create a controllable promise for the fire-and-forget fetch
    let fetchReject: (err: Error) => void;
    const fetchPromise = new Promise<Response>((_resolve, reject) => {
      fetchReject = reject;
    });

    const errPoolClient = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };

    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // cache miss
      .mockResolvedValueOnce({ rows: [{ id: "failed-search" }] }) // insert ctx
      .mockResolvedValueOnce({ rows: [] }); // insert state

    mockFetch.mockReturnValueOnce(fetchPromise);

    const request = new NextRequest("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        origin: "JFK",
        destination: "LHR",
        departureDate: "2026-04-10",
        cabinClass: "economy",
        directOnly: false,
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.status).toBe("running");

    // Set up pool.connect for the error handler
    mockPoolConnect.mockResolvedValueOnce(errPoolClient);

    // Now simulate a network error
    fetchReject!(new Error("Connection refused"));

    // Let microtasks and promise chains resolve
    await new Promise((r) => setTimeout(r, 50));

    // The error handler should have called pool.connect and then query to update status
    expect(errPoolClient.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE agent_state"),
      ["failed-search", "Connection refused"]
    );
    expect(errPoolClient.release).toHaveBeenCalled();
  });

  it("uses env OPENAI_API_KEY when user key is not provided", async () => {
    // The module reads OPENAI_API_KEY at import time. Since it's already imported,
    // this test verifies the user-key ternary path. When `openaiApiKey` is empty
    // and env key is valid, it should use the env key and set provider to "openai".
    // We need to re-import the module with env set.
    vi.resetModules();
    process.env.OPENAI_API_KEY = "sk-test-envkey-1234567890";
    vi.mock("pg", () => ({
      Pool: vi.fn(() => ({ connect: mockPoolConnect })),
    }));
    vi.mock("@/lib/supabase", () => ({
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    }));

    const { POST: POST2 } = await import("./route");

    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // cache miss
      .mockResolvedValueOnce({ rows: [{ id: "env-key-search" }] })
      .mockResolvedValueOnce({ rows: [] });

    const request = new NextRequest("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        origin: "JFK",
        destination: "LHR",
        departureDate: "2026-04-10",
        cabinClass: "economy",
        directOnly: false,
      }),
    });

    const response = await POST2(request);
    const data = await response.json();
    expect(data.searchId).toBe("env-key-search");
    expect(data.status).toBe("running");

    // Verify the insert included "openai" as the LLM provider
    const insertCall = mockQuery.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("INSERT INTO agent_ctx")
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![1]).toContain("openai"); // llm_provider
    expect(insertCall![1]).toContain("gpt-4.1-mini"); // llm_model

    delete process.env.OPENAI_API_KEY;
  });

  it("handles browser-use non-Error throw and uses String(err)", async () => {
    let fetchReject: (err: unknown) => void;
    const fetchPromise = new Promise<Response>((_resolve, reject) => {
      fetchReject = reject;
    });

    const errPoolClient = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };

    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // cache miss
      .mockResolvedValueOnce({ rows: [{ id: "nonErr-search" }] }) // insert ctx
      .mockResolvedValueOnce({ rows: [] }); // insert state

    mockFetch.mockReturnValueOnce(fetchPromise);

    const request = new NextRequest("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        origin: "JFK",
        destination: "LHR",
        departureDate: "2026-04-10",
        cabinClass: "economy",
        directOnly: false,
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.status).toBe("running");

    mockPoolConnect.mockResolvedValueOnce(errPoolClient);

    // Reject with a non-Error value (e.g., string)
    fetchReject!("some string error");

    await new Promise((r) => setTimeout(r, 50));

    expect(errPoolClient.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE agent_state"),
      ["nonErr-search", "some string error"]
    );
  });

  it("handles browser-use non-ok response and marks search as failed", async () => {
    const errPoolClient = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };

    // Pre-set the pool.connect to return the error client for the .catch handler
    mockPoolConnect
      .mockResolvedValueOnce({ query: mockQuery, release: mockRelease }) // main request client
      .mockResolvedValueOnce(errPoolClient); // error handler client

    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // cache miss
      .mockResolvedValueOnce({ rows: [{ id: "err-search" }] }) // insert ctx
      .mockResolvedValueOnce({ rows: [] }); // insert state

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => "Service unavailable",
    });

    const request = new NextRequest("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        origin: "JFK",
        destination: "LHR",
        departureDate: "2026-04-10",
        cabinClass: "economy",
        directOnly: false,
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.status).toBe("running");

    // Let the fire-and-forget promise chain (.then → throw → .catch → pool.connect → query) resolve
    await new Promise((r) => setTimeout(r, 100));

    expect(errPoolClient.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE agent_state"),
      expect.arrayContaining(["err-search"])
    );
  });
});
