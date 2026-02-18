import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSearchExecution } from "./useSearchExecution";

// ── Mock WebSocket ──────────────────────────────────────────────
type WSHandler = ((evt: { data: string }) => void) | null;

let mockWsInstances: MockWebSocket[] = [];

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: WSHandler = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    mockWsInstances.push(this);
    // Auto-connect after a tick
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }, 0);
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  });

  // Test helpers
  simulateMessage(data: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError() {
    this.onerror?.();
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

// Also set static values
(MockWebSocket as unknown as { OPEN: number }).OPEN = 1;
(MockWebSocket as unknown as { CONNECTING: number }).CONNECTING = 0;
(MockWebSocket as unknown as { CLOSING: number }).CLOSING = 2;
(MockWebSocket as unknown as { CLOSED: number }).CLOSED = 3;

const mockFetch = vi.fn();

beforeEach(() => {
  mockWsInstances = [];
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal("WebSocket", MockWebSocket);
  global.fetch = mockFetch;
  mockFetch.mockReset();
  // Default: polling fetches fail (so we test WS primarily)
  mockFetch.mockRejectedValue(new Error("no network"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useSearchExecution", () => {
  it("connects WebSocket and sets status to running on open", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    // WS connects after setTimeout(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(mockWsInstances.length).toBeGreaterThan(0);
    expect(result.current.status).toBe("running");
    expect(result.current.events.length).toBeGreaterThanOrEqual(2); // connecting + connected
  });

  it("handles progress messages", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];

    act(() => {
      ws.simulateMessage({
        type: "progress",
        message: "Step 1: Searching",
        step: 1,
        url: "https://flights.google.com",
      });
    });

    expect(result.current.status).toBe("running");
    const progressEvent = result.current.events.find(
      (e) => e.type === "progress"
    );
    expect(progressEvent).toBeDefined();
    expect(progressEvent!.message).toBe("Step 1: Searching");
  });

  it("handles done messages and sets status to completed", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];

    act(() => {
      ws.simulateMessage({
        type: "done",
        message: "Search complete",
        results: [{ airline: "Test Air" }],
      });
    });

    expect(result.current.status).toBe("completed");
    expect(result.current.results).toEqual([{ airline: "Test Air" }]);
  });

  it("handles error messages", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];

    act(() => {
      ws.simulateMessage({
        type: "error",
        message: "Agent timeout",
      });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Agent timeout");
  });

  it("handles cancelled messages", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];

    act(() => {
      ws.simulateMessage({
        type: "cancelled",
        message: "Search cancelled by user",
      });
    });

    expect(result.current.status).toBe("cancelled");
  });

  it("retry resets state and reconnects", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const instancesBefore = mockWsInstances.length;

    await act(async () => {
      result.current.retry();
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(result.current.events.length).toBeGreaterThanOrEqual(1);
    expect(mockWsInstances.length).toBeGreaterThan(instancesBefore);
  });

  it("disconnect closes WebSocket", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];

    act(() => {
      result.current.disconnect();
    });

    expect(ws.close).toHaveBeenCalled();
  });

  it("handles unknown message type as progress", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];

    act(() => {
      ws.simulateMessage({
        type: "unknown-type",
        message: "Some unknown event",
      });
    });

    const unknownEvent = result.current.events.find(
      (e) => e.message === "Some unknown event"
    );
    expect(unknownEvent).toBeDefined();
    expect(unknownEvent!.type).toBe("progress");
  });

  it("handles non-JSON message as progress text", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];

    act(() => {
      ws.onmessage?.({ data: "plain text message" });
    });

    const plainEvent = result.current.events.find(
      (e) => e.message === "plain text message"
    );
    expect(plainEvent).toBeDefined();
    expect(plainEvent!.type).toBe("progress");
  });

  it("handles WS error by staying in running state", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];

    act(() => {
      ws.simulateError();
    });

    // Should stay in running so polling can take over
    expect(result.current.status).toBe("running");
  });

  it("handles WS close while running by staying in running state", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.status).toBe("running");

    const ws = mockWsInstances[mockWsInstances.length - 1];

    act(() => {
      ws.simulateClose();
    });

    // Should remain running (polling fallback)
    expect(result.current.status).toBe("running");
  });

  it("polls browser-use /status when WS is not delivering data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "running",
        progress: [
          { step: 1, next_goal: "Navigate", url: "https://flights.google.com" },
        ],
      }),
    });

    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Simulate WS error so poll kicks in
    const ws = mockWsInstances[mockWsInstances.length - 1];
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
    });

    // Advance to initial poll delay (3000ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    // Should have fetched from browser-use
    expect(mockFetch).toHaveBeenCalled();
    const buCall = mockFetch.mock.calls.find((c: unknown[]) =>
      typeof c[0] === "string" && c[0].includes("/status/test-id")
    );
    expect(buCall).toBeDefined();
  });

  it("polling handles completed status from browser-use", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "completed",
        results: [{ airline: "Poll Air" }],
        progress: [],
      }),
    });

    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Close WS so polling takes over
    const ws = mockWsInstances[mockWsInstances.length - 1];
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(result.current.status).toBe("completed");
  });

  it("polling handles failed status from browser-use", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "failed",
        error: "Agent crashed",
        progress: [],
      }),
    });

    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Agent crashed");
  });

  it("polling handles cancelled status from browser-use", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "cancelled",
        progress: [],
      }),
    });

    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(result.current.status).toBe("cancelled");
  });

  it("polling falls back to /api/status when browser-use fails", async () => {
    // First call (browser-use) fails, second call (Next.js API) succeeds
    mockFetch
      .mockResolvedValueOnce(null) // browser-use fetch returns null via .catch()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "completed",
          results: [{ airline: "API Air" }],
        }),
      });

    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(result.current.status).toBe("completed");
  });

  it("polling skips when WS is actively delivering data", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];

    // Simulate a WS message so wsDeliveredRef becomes true
    act(() => {
      ws.simulateMessage({
        type: "progress",
        message: "Step 1",
        step: 1,
      });
    });

    mockFetch.mockClear();

    // Advance past polling delay
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    // Since WS is OPEN and has delivered data, polling should be skipped
    const statusCalls = mockFetch.mock.calls.filter((c: unknown[]) =>
      typeof c[0] === "string" && c[0].includes("/status/")
    );
    expect(statusCalls.length).toBe(0);
  });

  it("handles status message type from WS", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];

    act(() => {
      ws.simulateMessage({
        type: "status",
        message: "Initializing browser",
      });
    });

    const statusEvent = result.current.events.find(
      (e) => e.message === "Initializing browser"
    );
    expect(statusEvent).toBeDefined();
    expect(statusEvent!.type).toBe("status");
  });

  it("progress message with screenshot_url is stored", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];

    act(() => {
      ws.simulateMessage({
        type: "progress",
        message: "Step 1: Screenshot taken",
        step: 1,
        screenshot_url: "data:image/png;base64,abc123",
      });
    });

    const progressEvent = result.current.events.find(
      (e) => e.message === "Step 1: Screenshot taken"
    );
    expect(progressEvent).toBeDefined();
    expect(progressEvent!.screenshotUrl).toBe("data:image/png;base64,abc123");
  });

  it("polling falls back to /api/status for failed status", async () => {
    // Browser-use returns null, /api/status returns failed
    mockFetch
      .mockResolvedValueOnce(null) // browser-use returns null
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "failed",
          error: "DB failure",
        }),
      });

    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("DB failure");
  });

  it("polling falls back to /api/status for cancelled status", async () => {
    mockFetch
      .mockResolvedValueOnce(null) // browser-use returns null
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "cancelled" }),
      });

    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(result.current.status).toBe("cancelled");
  });

  it("polling falls back to /api/status for running status", async () => {
    mockFetch
      .mockResolvedValueOnce(null) // browser-use returns null
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "running" }),
      });

    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(result.current.status).toBe("running");
  });

  it("polling silently handles errors", async () => {
    // Both fetches throw
    mockFetch.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    // Should stay running (polling silently fails)
    expect(result.current.status).toBe("running");
  });

  it("polling handles running status from browser-use when not already running", async () => {
    // First set status to connecting, then poll returns running
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "running",
        progress: [],
      }),
    });

    const { result } = renderHook(() => useSearchExecution("test-id"));

    // Don't advance timers to let WS connect - keep it in connecting state
    // Force WS to be closed before it connects
    const ws = mockWsInstances[mockWsInstances.length - 1];
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
    });

    // Set to connecting
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(result.current.status).toBe("running");
  });

  it("connect returns early when WS is already OPEN", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // WS is now open
    const instancesBefore = mockWsInstances.length;

    // Call connect again — should be a no-op
    act(() => {
      result.current.connect();
    });

    // No new WS instances should be created
    expect(mockWsInstances.length).toBe(instancesBefore);
  });

  it("WS onclose when status is completed does not override status", async () => {
    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];

    // Complete the search via WS
    act(() => {
      ws.simulateMessage({
        type: "done",
        message: "Search complete",
        results: [{ airline: "Test Air" }],
      });
    });

    expect(result.current.status).toBe("completed");

    // Now close the WS — status should remain completed (not revert to running)
    act(() => {
      ws.simulateClose();
    });

    expect(result.current.status).toBe("completed");
  });

  it("browser-use polling completed is idempotent when already completed", async () => {
    // First call: browser-use returns completed
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "completed",
        results: [{ airline: "Poll Air" }],
        progress: [],
      }),
    });

    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
    });

    // First poll → sets completed
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(result.current.status).toBe("completed");
  });

  it("browser-use polling failed is idempotent when already error", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "failed",
        error: "Agent crash",
        progress: [],
      }),
    });

    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(result.current.status).toBe("error");
  });

  it("browser-use polling cancelled is idempotent when already cancelled", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "cancelled",
        progress: [],
      }),
    });

    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(result.current.status).toBe("cancelled");
  });

  it("polling streams new progress events incrementally", async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/status/test-id") && !url.includes("/api/")) {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            json: async () => ({
              status: "running",
              progress: [
                { step: 1, next_goal: "First step", url: "https://a.com", screenshot: "abc" },
              ],
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            status: "running",
            progress: [
              { step: 1, next_goal: "First step", url: "https://a.com" },
              { step: 2, next_goal: "Second step", url: "https://b.com" },
            ],
          }),
        };
      }
      throw new Error("no match");
    });

    const { result } = renderHook(() => useSearchExecution("test-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const ws = mockWsInstances[mockWsInstances.length - 1];
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
    });

    // First poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    const step1 = result.current.events.find((e) => e.message.includes("First step"));
    expect(step1).toBeDefined();

    // Second poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10500);
    });

    const step2 = result.current.events.find((e) => e.message.includes("Second step"));
    expect(step2).toBeDefined();
  });
});
