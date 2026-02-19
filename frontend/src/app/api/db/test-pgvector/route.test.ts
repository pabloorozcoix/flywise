import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockConnect, mockEnd, mockExecute } = vi.hoisted(() => {
  const mockConnect = vi.fn();
  const mockEnd = vi.fn();
  const mockExecute = vi.fn();
  return { mockConnect, mockEnd, mockExecute };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {},
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
}));

vi.mock("pg", () => ({
  default: {
    Client: vi.fn(() => ({
      connect: mockConnect,
      end: mockEnd,
    })),
  },
  Client: vi.fn(() => ({
    connect: mockConnect,
    end: mockEnd,
  })),
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: vi.fn(() => ({ execute: mockExecute })),
}));

vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/db/test-pgvector", () => {
  it("returns pgvector_active with version and test result", async () => {
    mockConnect.mockResolvedValue(undefined);
    mockEnd.mockResolvedValue(undefined);
    mockExecute
      .mockResolvedValueOnce({ rows: [{ extversion: "0.7.0" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, embedding: "[1,2,3]", distance: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe("pgvector_active");
    expect(data.pgvectorVersion).toBe("0.7.0");
    expect(data.test.nearestId).toBe(1);
  });

  it("returns error when pgvector is not installed", async () => {
    mockConnect.mockResolvedValue(undefined);
    mockEnd.mockResolvedValue(undefined);
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const response = await GET();
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("pgvector extension is not installed");
  });

  it("returns error on connection failure", async () => {
    mockConnect.mockRejectedValue(new Error("DB down"));
    mockEnd.mockResolvedValue(undefined);

    const response = await GET();
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("DB down");
  });
});
