import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("POST /api/search/[id]/cancel", () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it("proxies cancel request to browser-use and returns response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "cancelled" }),
    });

    const request = new NextRequest("http://localhost/api/search/abc/cancel", { method: "POST" });
    const response = await POST(request, makeParams("abc-123"));
    const data = await response.json();

    expect(data.status).toBe("cancelled");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/search/abc-123/cancel"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns 502 when browser-use is unreachable", async () => {
    mockFetch.mockRejectedValue(new Error("Connection refused"));

    const request = new NextRequest("http://localhost/api/search/abc/cancel", { method: "POST" });
    const response = await POST(request, makeParams("xyz"));
    expect(response.status).toBe(502);

    const data = await response.json();
    expect(data.error).toBe("Connection refused");
  });

  it("returns generic message when non-Error is thrown", async () => {
    mockFetch.mockRejectedValue("string error");

    const request = new NextRequest("http://localhost/api/search/abc/cancel", { method: "POST" });
    const response = await POST(request, makeParams("xyz"));
    expect(response.status).toBe(502);

    const data = await response.json();
    expect(data.error).toBe("Failed to cancel search");
  });
});
