import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOllamaConnectionTest } from "./useOllamaConnectionTest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("useOllamaConnectionTest", () => {
  it("returns initial state", () => {
    const { result } = renderHook(() => useOllamaConnectionTest());
    expect(result.current.text).toBe("");
    expect(result.current.error).toBe("");
    expect(typeof result.current.handleTest).toBe("function");
  });

  it("streams text on success", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("Hello "));
        controller.enqueue(new TextEncoder().encode("World"));
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      body: stream,
    });

    const { result } = renderHook(() => useOllamaConnectionTest());

    await act(async () => {
      result.current.handleTest();
    });

    // Wait for stream to process
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.text).toBe("Hello World");
    expect(result.current.error).toBe("");
  });

  it("sets error on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Ollama unavailable" }),
    });

    const { result } = renderHook(() => useOllamaConnectionTest());

    await act(async () => {
      result.current.handleTest();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Ollama unavailable");
  });

  it("sets error on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network fail"));

    const { result } = renderHook(() => useOllamaConnectionTest());

    await act(async () => {
      result.current.handleTest();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Network fail");
  });

  it("uses fallback error when non-ok response has no error field", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useOllamaConnectionTest());

    await act(async () => {
      result.current.handleTest();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Unable to connect to Ollama");
  });

  it("handles null response body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: null,
    });

    const { result } = renderHook(() => useOllamaConnectionTest());

    await act(async () => {
      result.current.handleTest();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("No response body");
  });

  it("handles non-Error throw gracefully", async () => {
    mockFetch.mockRejectedValue("string error");

    const { result } = renderHook(() => useOllamaConnectionTest());

    await act(async () => {
      result.current.handleTest();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Unknown error");
  });
});
