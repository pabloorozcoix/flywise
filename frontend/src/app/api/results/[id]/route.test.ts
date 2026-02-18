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

describe("GET /api/results/[id]", () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it("returns 404 when search not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const request = new NextRequest("http://localhost/api/results/unknown");
    const response = await GET(request, makeParams("unknown"));
    expect(response.status).toBe(404);
  });

  it("returns results for completed search", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "s1", origin: "JFK", destination: "LHR", departure_date: "2026-04-10",
          return_date: null, cabin_class: "economy", direct_only: false,
          llm_provider: "ollama", llm_model: "qwen3:8b",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ status: "completed", error_message: null }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "r1", airline: "BA",
          departure_time: new Date("2026-04-10T08:00:00Z"),
          arrival_time: new Date("2026-04-10T20:00:00Z"),
          duration: "7h", stops: 0, price: "450.00", currency: "USD",
          flight_url: "https://ba.com", raw_data: null,
        }],
      });

    const request = new NextRequest("http://localhost/api/results/s1");
    const response = await GET(request, makeParams("s1"));
    const data = await response.json();

    expect(data.searchId).toBe("s1");
    expect(data.status).toBe("completed");
    expect(data.results).toHaveLength(1);
    expect(data.results[0].airline).toBe("BA");
    expect(data.results[0].price).toBe(450);
  });

  it("falls back to raw_data for missing time fields", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "s2", origin: "LAX", destination: "NRT", departure_date: "2026-05-01",
          return_date: null, cabin_class: "business", direct_only: true,
          llm_provider: "openai", llm_model: "gpt-4.1-mini",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ status: "completed", error_message: null }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "r2", airline: "ANA", departure_time: null, arrival_time: null,
          duration: null, stops: null, price: null, currency: null, flight_url: null,
          raw_data: JSON.stringify({
            departure_time: "2026-05-01T10:00:00Z", arrival_time: "2026-05-02T06:00:00Z",
            duration: "11h", stops: 1, price: 2500, currency: "USD",
            flight_url: "https://ana.co.jp",
          }),
        }],
      });

    const request = new NextRequest("http://localhost/api/results/s2");
    const response = await GET(request, makeParams("s2"));
    const data = await response.json();

    expect(data.results[0].duration).toBe("11h");
    expect(data.results[0].price).toBe(2500);
  });

  it("handles raw_data as pre-parsed object (not string)", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "s3", origin: "LAX", destination: "NRT", departure_date: "2026-05-01",
          return_date: null, cabin_class: "business", direct_only: true,
          llm_provider: "openai", llm_model: "gpt-4.1-mini",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ status: "completed", error_message: null }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "r3", airline: "ANA", departure_time: null, arrival_time: null,
          duration: null, stops: null, price: null, currency: null, flight_url: null,
          raw_data: { // already an object, not a JSON string
            departure_time: "2026-05-01T10:00:00Z", arrival_time: "2026-05-02T06:00:00Z",
            duration: "11h", stops: 1, price: 2500, currency: "JPY",
            flight_url: "https://ana.co.jp",
          },
        }],
      });

    const request = new NextRequest("http://localhost/api/results/s3");
    const response = await GET(request, makeParams("s3"));
    const data = await response.json();

    expect(data.results[0].duration).toBe("11h");
    expect(data.results[0].currency).toBe("JPY");
  });

  it("falls back to defaults when llm_provider and llm_model are null", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "s4", origin: "JFK", destination: "LHR", departure_date: "2026-04-10",
          return_date: null, cabin_class: "economy", direct_only: false,
          llm_provider: null, llm_model: null,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ status: "completed", error_message: null }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const request = new NextRequest("http://localhost/api/results/s4");
    const response = await GET(request, makeParams("s4"));
    const data = await response.json();

    expect(data.llm.provider).toBe("ollama");
    expect(data.llm.model).toBe("qwen3:8b");
  });

  it("returns 'unknown' status when no agent_state rows exist", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "s5", origin: "JFK", destination: "LHR", departure_date: "2026-04-10",
          return_date: null, cabin_class: "economy", direct_only: false,
          llm_provider: "ollama", llm_model: "qwen3:8b",
        }],
      })
      .mockResolvedValueOnce({ rows: [] }) // no agent_state
      .mockResolvedValueOnce({ rows: [] });

    const request = new NextRequest("http://localhost/api/results/s5");
    const response = await GET(request, makeParams("s5"));
    const data = await response.json();

    expect(data.status).toBe("unknown");
  });

  it("uses toISOString for non-null departure_time and handles all fallback chains", async () => {
    const depTime = new Date("2026-04-10T08:00:00Z");
    const arrTime = new Date("2026-04-10T20:00:00Z");
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "s6", origin: "JFK", destination: "LHR", departure_date: "2026-04-10",
          return_date: null, cabin_class: "economy", direct_only: false,
          llm_provider: "ollama", llm_model: "qwen3:8b",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ status: "completed", error_message: null }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "r6", airline: "BA",
          departure_time: depTime,
          arrival_time: arrTime,
          duration: "12h", stops: 0, price: "450.50", currency: "USD",
          flight_url: "https://ba.com", raw_data: null,
        }],
      });

    const request = new NextRequest("http://localhost/api/results/s6");
    const response = await GET(request, makeParams("s6"));
    const data = await response.json();

    expect(data.results[0].departure).toBe(depTime.toISOString());
    expect(data.results[0].arrival).toBe(arrTime.toISOString());
    expect(data.results[0].price).toBe(450.5);
    expect(data.results[0].currency).toBe("USD");
    expect(data.results[0].url).toBe("https://ba.com");
  });

  it("handles result with all nulls and no raw_data", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "s7", origin: "JFK", destination: "LHR", departure_date: "2026-04-10",
          return_date: null, cabin_class: "economy", direct_only: false,
          llm_provider: "ollama", llm_model: "qwen3:8b",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ status: "completed", error_message: null }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "r7", airline: "Unknown",
          departure_time: null, arrival_time: null,
          duration: null, stops: null, price: null, currency: null,
          flight_url: null, raw_data: null,
        }],
      });

    const request = new NextRequest("http://localhost/api/results/s7");
    const response = await GET(request, makeParams("s7"));
    const data = await response.json();

    expect(data.results[0].departure).toBe("");
    expect(data.results[0].arrival).toBe("");
    expect(data.results[0].duration).toBe("");
    expect(data.results[0].stops).toBe(0);
    expect(data.results[0].price).toBe(0);
    expect(data.results[0].currency).toBe("USD");
    expect(data.results[0].url).toBeNull();
  });

  it("returns 500 on unexpected error (e.g. pool.connect failure)", async () => {
    mockPoolConnect.mockRejectedValueOnce(new Error("DB down"));

    const request = new NextRequest("http://localhost/api/results/s1");
    const response = await GET(request, makeParams("s1"));
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("Internal server error");
  });
});
