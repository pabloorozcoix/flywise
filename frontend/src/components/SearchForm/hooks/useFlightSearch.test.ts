import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFlightSearch } from "./useFlightSearch";
import { validOneWay } from "@/__tests__/fixtures/searchParams";
import { mockPush } from "@/__tests__/setup";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockPush.mockReset();
});

describe("useFlightSearch", () => {
  it("returns initial state", () => {
    const { result } = renderHook(() => useFlightSearch());
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.submitSearch).toBe("function");
  });

  it("on success, redirects to /history/{searchId}", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ searchId: "abc-123" }),
    });

    const { result } = renderHook(() => useFlightSearch());

    await act(async () => {
      await result.current.submitSearch(validOneWay);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validOneWay),
    });
    expect(mockPush).toHaveBeenCalledWith("/history/abc-123");
  });

  it("on API error, sets error message from response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid parameters" }),
    });

    const { result } = renderHook(() => useFlightSearch());

    await act(async () => {
      await result.current.submitSearch(validOneWay);
    });

    expect(result.current.error).toBe("Invalid parameters");
    expect(result.current.isSubmitting).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("on API error with no JSON body, uses status code", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("no json");
      },
    });

    const { result } = renderHook(() => useFlightSearch());

    await act(async () => {
      await result.current.submitSearch(validOneWay);
    });

    expect(result.current.error).toBe("Search failed (500)");
  });

  it("on network failure, sets error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useFlightSearch());

    await act(async () => {
      await result.current.submitSearch(validOneWay);
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.isSubmitting).toBe(false);
  });

  it("handles non-Error throw gracefully", async () => {
    mockFetch.mockRejectedValue("string error");

    const { result } = renderHook(() => useFlightSearch());

    await act(async () => {
      await result.current.submitSearch(validOneWay);
    });

    expect(result.current.error).toBe("An error occurred");
    expect(result.current.isSubmitting).toBe(false);
  });
});
