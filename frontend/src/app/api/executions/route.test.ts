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

describe("GET /api/executions", () => {
  it("returns executions list from database", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          search_id: "id-1",
          origin: "JFK",
          destination: "LHR",
          departure_date: "2026-04-10",
          return_date: null,
          cabin_class: "economy",
          direct_only: false,
          created_at: new Date("2026-02-19T12:00:00Z"),
          status: "completed",
          error_message: null,
          started_at: new Date("2026-02-19T12:00:00Z"),
          completed_at: new Date("2026-02-19T12:05:00Z"),
          result_count: 5,
        },
      ],
    });

    const request = new NextRequest("http://localhost/api/executions");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.executions).toHaveLength(1);
    expect(data.executions[0]).toEqual({
      searchId: "id-1",
      origin: "JFK",
      destination: "LHR",
      departureDate: "2026-04-10",
      returnDate: null,
      cabinClass: "economy",
      directOnly: false,
      createdAt: "2026-02-19T12:00:00Z",
      status: "completed",
      errorMessage: null,
      startedAt: "2026-02-19T12:00:00Z",
      completedAt: "2026-02-19T12:05:00Z",
      resultCount: 5,
    });
  });

  it("returns empty executions when no rows", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const request = new NextRequest("http://localhost/api/executions");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.executions).toEqual([]);
  });

  it("maps null/undefined fields correctly", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          search_id: "id-2",
          origin: "LAX",
          destination: "CDG",
          departure_date: "2026-05-01",
          return_date: null,
          cabin_class: null,
          direct_only: null,
          created_at: null,
          status: null,
          error_message: "Something failed",
          started_at: null,
          completed_at: null,
          result_count: null,
        },
      ],
    });

    const request = new NextRequest("http://localhost/api/executions");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.executions[0].returnDate).toBeNull();
    expect(data.executions[0].cabinClass).toBeNull();
    expect(data.executions[0].directOnly).toBe(false);
    expect(data.executions[0].createdAt).toBeNull();
    expect(data.executions[0].status).toBe("pending");
    expect(data.executions[0].errorMessage).toBe("Something failed");
    expect(data.executions[0].resultCount).toBe(0);
  });

  it("releases the client after query", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const request = new NextRequest("http://localhost/api/executions");
    await GET(request);

    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when pool.connect throws", async () => {
    mockPoolConnect.mockRejectedValueOnce(new Error("Connection refused"));

    const request = new NextRequest("http://localhost/api/executions");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("returns 500 when query throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Syntax error"));

    const request = new NextRequest("http://localhost/api/executions");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
