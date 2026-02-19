import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSystemStatus } from "./useSystemStatus";
import { systemHealthy, systemDegraded } from "@/__tests__/fixtures/apiResponses";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("useSystemStatus", () => {
  it("returns initial state", () => {
    const { result } = renderHook(() => useSystemStatus());
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe("");
  });

  it("handleRefresh sets healthy result", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => systemHealthy,
    });

    const { result } = renderHook(() => useSystemStatus());

    await act(async () => {
      result.current.handleRefresh();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.result?.status).toBe("healthy");
    expect(result.current.result?.services).toHaveLength(3);
  });

  it("handleRefresh sets degraded result", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => systemDegraded,
    });

    const { result } = renderHook(() => useSystemStatus());

    await act(async () => {
      result.current.handleRefresh();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.result?.status).toBe("degraded");
  });

  it("handleRefresh sets error on failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useSystemStatus());

    await act(async () => {
      result.current.handleRefresh();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Failed to fetch system status");
  });

  it("handles non-Error throw gracefully", async () => {
    mockFetch.mockRejectedValue("string error");

    const { result } = renderHook(() => useSystemStatus());

    await act(async () => {
      result.current.handleRefresh();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Unknown error");
  });
});
