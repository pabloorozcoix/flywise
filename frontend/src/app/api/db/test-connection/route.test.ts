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

describe("GET /api/db/test-connection", () => {
  it("returns connected with version on success", async () => {
    mockConnect.mockResolvedValue(undefined);
    mockEnd.mockResolvedValue(undefined);
    mockExecute.mockResolvedValue({ rows: [{ version: "PostgreSQL 16.1 on x86_64" }] });

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe("connected");
    expect(data.version).toBe("PostgreSQL 16.1 on x86_64");
  });

  it("returns error on connection failure", async () => {
    mockConnect.mockRejectedValue(new Error("ECONNREFUSED"));
    mockEnd.mockResolvedValue(undefined);

    const response = await GET();
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.status).toBe("error");
    expect(data.error).toBe("ECONNREFUSED");
  });
});
