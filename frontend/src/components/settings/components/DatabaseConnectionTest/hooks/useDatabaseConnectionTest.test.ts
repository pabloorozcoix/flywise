import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDatabaseConnectionTest } from "./useDatabaseConnectionTest";
import { dbConnected, pgvectorActive } from "@/__tests__/fixtures/apiResponses";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("useDatabaseConnectionTest", () => {
  it("returns initial state", () => {
    const { result } = renderHook(() => useDatabaseConnectionTest());
    expect(result.current.connectionResult).toBeNull();
    expect(result.current.pgvectorResult).toBeNull();
    expect(result.current.error).toBe("");
  });

  it("handleTestConnection sets connectionResult on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => dbConnected,
    });

    const { result } = renderHook(() => useDatabaseConnectionTest());

    await act(async () => {
      result.current.handleTestConnection();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.connectionResult).toEqual(dbConnected);
    expect(result.current.error).toBe("");
  });

  it("handleTestPgvector sets pgvectorResult on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => pgvectorActive,
    });

    const { result } = renderHook(() => useDatabaseConnectionTest());

    await act(async () => {
      result.current.handleTestPgvector();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.pgvectorResult).toEqual(pgvectorActive);
  });

  it("sets error on connection failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Connection refused" }),
    });

    const { result } = renderHook(() => useDatabaseConnectionTest());

    await act(async () => {
      result.current.handleTestConnection();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Connection refused");
  });

  it("sets error on pgvector test failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "pgvector extension not found" }),
    });

    const { result } = renderHook(() => useDatabaseConnectionTest());

    await act(async () => {
      result.current.handleTestPgvector();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("pgvector extension not found");
  });

  it("sets error on pgvector test network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useDatabaseConnectionTest());

    await act(async () => {
      result.current.handleTestPgvector();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Network failure");
  });

  it("uses fallback error when connection non-ok response has no error field", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useDatabaseConnectionTest());

    await act(async () => {
      result.current.handleTestConnection();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Unable to connect to database");
  });

  it("uses fallback error when pgvector non-ok response has no error field", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useDatabaseConnectionTest());

    await act(async () => {
      result.current.handleTestPgvector();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Unable to test pgvector");
  });

  it("handles non-Error throw in handleTestConnection", async () => {
    mockFetch.mockRejectedValue("string error");

    const { result } = renderHook(() => useDatabaseConnectionTest());

    await act(async () => {
      result.current.handleTestConnection();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Unknown error");
  });

  it("handles non-Error throw in handleTestPgvector", async () => {
    mockFetch.mockRejectedValue("string error");

    const { result } = renderHook(() => useDatabaseConnectionTest());

    await act(async () => {
      result.current.handleTestPgvector();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Unknown error");
  });
});
