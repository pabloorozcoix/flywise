import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("GET /api/browser-use/health", () => {
  it("returns ok when browser-use is healthy", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "healthy" }),
    });

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe("ok");
    expect(data.serviceStatus).toBe("healthy");
    expect(data.url).toBeDefined();
  });

  it("returns 502 when browser-use returns non-ok", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const response = await GET();
    expect(response.status).toBe(502);

    const data = await response.json();
    expect(data.status).toBe("error");
  });

  it("returns 503 when connection fails", async () => {
    mockFetch.mockRejectedValue(new Error("Connection refused"));

    const response = await GET();
    expect(response.status).toBe(503);

    const data = await response.json();
    expect(data.error).toBe("Connection refused");
  });
});
