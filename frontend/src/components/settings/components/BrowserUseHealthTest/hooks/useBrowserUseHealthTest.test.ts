import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBrowserUseHealthTest } from "./useBrowserUseHealthTest";
import { browserUseHealthy } from "@/__tests__/fixtures/apiResponses";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("useBrowserUseHealthTest", () => {
  it("returns initial state", () => {
    const { result } = renderHook(() => useBrowserUseHealthTest());
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe("");
  });

  it("handleTest sets result on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => browserUseHealthy,
    });

    const { result } = renderHook(() => useBrowserUseHealthTest());

    await act(async () => {
      result.current.handleTest();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.result).toEqual(browserUseHealthy);
  });

  it("handleTest sets error on failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Service down" }),
    });

    const { result } = renderHook(() => useBrowserUseHealthTest());

    await act(async () => {
      result.current.handleTest();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Service down");
  });

  it("handleTest sets error on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("Timeout"));

    const { result } = renderHook(() => useBrowserUseHealthTest());

    await act(async () => {
      result.current.handleTest();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Timeout");
  });

  it("uses fallback error text when no error field in non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useBrowserUseHealthTest());

    await act(async () => {
      result.current.handleTest();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Unable to connect to browser-use service");
  });

  it("handles non-Error throw gracefully", async () => {
    mockFetch.mockRejectedValue("string error");

    const { result } = renderHook(() => useBrowserUseHealthTest());

    await act(async () => {
      result.current.handleTest();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Unknown error");
  });
});
