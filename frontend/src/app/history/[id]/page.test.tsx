import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Hoisted mocks ──
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({ id: "search-abc" }),
  usePathname: () => "/history/search-abc",
  useSearchParams: () => new URLSearchParams(),
}));

// ── Mock useSearchExecution ──
const mockRetry = vi.fn();

interface MockSearchExecution {
  status: string;
  events: unknown[];
  error: string | undefined;
  results: unknown[] | undefined;
  retry: typeof mockRetry;
}

const mockUseSearchExecution = vi.fn((): MockSearchExecution => ({
  status: "running",
  events: [],
  error: undefined,
  results: undefined,
  retry: mockRetry,
}));

vi.mock("@/components/ExecutionTimeline/hooks/useSearchExecution", () => ({
  useSearchExecution: () => mockUseSearchExecution(),
}));

import SearchExecutionPage from "./page";

describe("SearchExecution (History) page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], searchParams: null }),
    });
    mockUseSearchExecution.mockReturnValue({
      status: "running",
      events: [],
      error: undefined,
      results: undefined,
      retry: mockRetry,
    });
  });

  it("renders the Flight Search heading", () => {
    render(<SearchExecutionPage />);
    expect(screen.getByText("Flight Search")).toBeInTheDocument();
  });

  it("renders the Back button", () => {
    render(<SearchExecutionPage />);
    expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
  });

  it("navigates home when Back is clicked", async () => {
    const user = userEvent.setup();
    render(<SearchExecutionPage />);
    await user.click(screen.getByRole("button", { name: /Back/i }));
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("renders the Execution Timeline heading", () => {
    render(<SearchExecutionPage />);
    expect(screen.getByText("Execution Timeline")).toBeInTheDocument();
  });

  it("shows the session ID", () => {
    render(<SearchExecutionPage />);
    expect(screen.getByText(/search-abc/)).toBeInTheDocument();
  });

  it("shows running status from useSearchExecution", () => {
    render(<SearchExecutionPage />);
    expect(screen.getByText(/Agent is working/i)).toBeInTheDocument();
  });

  it("shows Terminate button while running", () => {
    render(<SearchExecutionPage />);
    expect(screen.getByRole("button", { name: /Terminate/i })).toBeInTheDocument();
  });

  it("calls fetch cancel API on Terminate", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [], searchParams: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    render(<SearchExecutionPage />);
    await user.click(screen.getByRole("button", { name: /Terminate/i }));

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const cancelCall = calls.find(
        (c: unknown[]) =>
          typeof c[0] === "string" && c[0].includes("/api/search/search-abc/cancel")
      );
      expect(cancelCall).toBeDefined();
    });
  });

  it("shows completed state with View Results button", () => {
    mockUseSearchExecution.mockReturnValue({
      status: "completed",
      events: [],
      error: undefined,
      results: [],
      retry: mockRetry,
    });
    render(<SearchExecutionPage />);
    expect(screen.getByText(/Search complete/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View Results/i })).toBeInTheDocument();
  });

  it("navigates to results page on View Results click", async () => {
    const user = userEvent.setup();
    mockUseSearchExecution.mockReturnValue({
      status: "completed",
      events: [],
      error: undefined,
      results: [],
      retry: mockRetry,
    });
    render(<SearchExecutionPage />);
    await user.click(screen.getByRole("button", { name: /View Results/i }));
    expect(mockPush).toHaveBeenCalledWith("/results/search-abc");
  });

  it("hides Terminate button when completed", () => {
    mockUseSearchExecution.mockReturnValue({
      status: "completed",
      events: [],
      error: undefined,
      results: [],
      retry: mockRetry,
    });
    render(<SearchExecutionPage />);
    expect(screen.queryByRole("button", { name: /Terminate/i })).not.toBeInTheDocument();
  });

  it("shows error status from useSearchExecution", () => {
    mockUseSearchExecution.mockReturnValue({
      status: "error",
      events: [],
      error: "Agent timeout",
      results: undefined,
      retry: mockRetry,
    });
    render(<SearchExecutionPage />);
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Agent timeout")).toBeInTheDocument();
  });

  it("shows connecting status", () => {
    mockUseSearchExecution.mockReturnValue({
      status: "connecting",
      events: [],
      error: undefined,
      results: undefined,
      retry: mockRetry,
    });
    render(<SearchExecutionPage />);
    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
    // Terminate should also be visible during connecting
    expect(screen.getByRole("button", { name: /Terminate/i })).toBeInTheDocument();
  });

  it("shows LLM badge when llmInfo is returned", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [],
        searchParams: null,
        llm: { provider: "ollama", model: "qwen3:8b" },
      }),
    });

    render(<SearchExecutionPage />);
    await waitFor(() => {
      expect(screen.getByText(/Ollama · qwen3:8b/)).toBeInTheDocument();
    });
  });

  it("shows OpenAI badge when provider is openai", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [],
        searchParams: null,
        llm: { provider: "openai", model: "gpt-4.1-mini" },
      }),
    });

    render(<SearchExecutionPage />);
    await waitFor(() => {
      expect(screen.getByText(/OpenAI · gpt-4.1-mini/)).toBeInTheDocument();
    });
  });

  it("shows Agent Output JSON section when completed", async () => {
    mockUseSearchExecution.mockReturnValue({
      status: "completed",
      events: [],
      error: undefined,
      results: [],
      retry: mockRetry,
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ id: "f1", airline: "TestAir" }],
        searchParams: { origin: "JFK", destination: "LHR", departureDate: "2026-04-10", cabinClass: "economy", directOnly: false },
      }),
    });

    render(<SearchExecutionPage />);
    await waitFor(() => {
      expect(screen.getByText(/Agent Output/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Copy JSON/i })).toBeInTheDocument();
  });

  it("copies JSON to clipboard on Copy JSON click", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText, readText: vi.fn() },
      writable: true,
      configurable: true,
    });

    mockUseSearchExecution.mockReturnValue({
      status: "completed",
      events: [],
      error: undefined,
      results: [],
      retry: mockRetry,
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ id: "f1", airline: "TestAir" }],
        searchParams: { origin: "JFK", destination: "LHR", departureDate: "2026-04-10", cabinClass: "economy", directOnly: false },
      }),
    });

    render(<SearchExecutionPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Copy JSON/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Copy JSON/i }));
    expect(writeText).toHaveBeenCalled();
    // After copying, button text changes to "Copied"
    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeInTheDocument();
    });
  });

  it("toggles JSON panel collapse", async () => {
    const user = userEvent.setup();
    mockUseSearchExecution.mockReturnValue({
      status: "completed",
      events: [],
      error: undefined,
      results: [],
      retry: mockRetry,
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ id: "f1", airline: "TestAir" }],
        searchParams: { origin: "JFK", destination: "LHR", departureDate: "2026-04-10", cabinClass: "economy", directOnly: false },
      }),
    });

    render(<SearchExecutionPage />);
    await waitFor(() => {
      expect(screen.getByText(/Agent Output/)).toBeInTheDocument();
    });

    // JSON is expanded by default — the <pre> should be visible
    expect(document.querySelector("pre")).toBeInTheDocument();

    // Click the toggle to collapse
    await user.click(screen.getByText(/Agent Output/));
    expect(document.querySelector("pre")).not.toBeInTheDocument();

    // Click again to expand
    await user.click(screen.getByText(/Agent Output/));
    expect(document.querySelector("pre")).toBeInTheDocument();
  });

  it("handles terminate failure gracefully", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [], searchParams: null }) })
      .mockRejectedValueOnce(new Error("Network error"));

    render(<SearchExecutionPage />);
    await user.click(screen.getByRole("button", { name: /Terminate/i }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Terminate request failed:", expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  it("handles terminate non-ok response", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [], searchParams: null }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal server error" }),
      });

    render(<SearchExecutionPage />);
    await user.click(screen.getByRole("button", { name: /Terminate/i }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it("shows idle status", () => {
    mockUseSearchExecution.mockReturnValue({
      status: "idle",
      events: [],
      error: undefined,
      results: undefined,
      retry: mockRetry,
    });
    render(<SearchExecutionPage />);
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });

  it("shows cancelled status", () => {
    mockUseSearchExecution.mockReturnValue({
      status: "cancelled",
      events: [],
      error: undefined,
      results: undefined,
      retry: mockRetry,
    });
    render(<SearchExecutionPage />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("handles fetch failure for search params silently", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    // Should render without errors even when param fetch fails
    render(<SearchExecutionPage />);
    expect(screen.getByText("Flight Search")).toBeInTheDocument();
  });

  it("polls for DB results after search completes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // First fetch returns no results (initial mount)
    let fetchCallCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      fetchCallCount++;
      if (fetchCallCount === 1) {
        return {
          ok: true,
          json: async () => ({ results: [], searchParams: null }),
        };
      }
      // Second+ calls return results (polling)
      return {
        ok: true,
        json: async () => ({
          results: [{ id: "f1", airline: "PolledAir" }],
          searchParams: { origin: "JFK", destination: "LHR", departureDate: "2026-04-10", cabinClass: "economy", directOnly: false },
        }),
      };
    });

    mockUseSearchExecution.mockReturnValue({
      status: "completed",
      events: [],
      error: undefined,
      results: [],
      retry: mockRetry,
    });

    render(<SearchExecutionPage />);

    // Advance past the initial delay (1000ms) and poll (2000ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    await waitFor(() => {
      expect(fetchCallCount).toBeGreaterThanOrEqual(2);
    });

    vi.useRealTimers();
  });

  it("retries polling when results are empty and handles catch", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let fetchCallCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      fetchCallCount++;
      if (fetchCallCount <= 2) {
        // First two calls: empty results (triggers retry)
        return {
          ok: true,
          json: async () => ({ results: [], searchParams: null }),
        };
      }
      // Third call: throw to hit the catch block
      throw new Error("Network error during poll");
    });

    mockUseSearchExecution.mockReturnValue({
      status: "completed",
      events: [],
      error: undefined,
      results: [],
      retry: mockRetry,
    });

    render(<SearchExecutionPage />);

    // Initial load fetch (fetchCallCount=1)
    // Then the post-completion poll useEffect starts: setTimeout(poll, 1000)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500); // triggers poll #1 (fetchCallCount=2, empty results → attempts++ → setTimeout 2000)
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500); // triggers poll #2 (fetchCallCount=3, throws → catch → attempts++ → setTimeout 2000)
    });

    // fetch should have been called at least 3 times
    expect(fetchCallCount).toBeGreaterThanOrEqual(3);

    vi.useRealTimers();
  });

  it("handles terminate non-ok response where json() throws", async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [], searchParams: null }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

    render(<SearchExecutionPage />);
    await user.click(screen.getByRole("button", { name: /Terminate/i }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to terminate:",
        expect.stringContaining("Internal Server Error")
      );
    });
    consoleSpy.mockRestore();
  });

  it("handles post-completion poll with non-ok response", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let fetchCallCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      fetchCallCount++;
      if (fetchCallCount === 1) {
        return { ok: true, json: async () => ({ results: [], searchParams: null }) };
      }
      // Polling returns non-ok
      return { ok: false, status: 500, json: async () => ({}) };
    });

    mockUseSearchExecution.mockReturnValue({
      status: "completed",
      events: [],
      error: undefined,
      results: [],
      retry: mockRetry,
    });

    render(<SearchExecutionPage />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    // Poll happened but returned non-ok, so it should retry
    expect(fetchCallCount).toBeGreaterThanOrEqual(2);

    vi.useRealTimers();
  });

  it("uses WS results as fallback when DB flights are not available", async () => {
    mockUseSearchExecution.mockReturnValue({
      status: "completed",
      events: [],
      error: undefined,
      results: [{ airline: "WS Air", price: 200 }],
      retry: mockRetry,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [], // DB returns empty
        searchParams: { origin: "JFK", destination: "LHR", departureDate: "2026-04-10", cabinClass: "economy", directOnly: false },
      }),
    });

    render(<SearchExecutionPage />);

    await waitFor(() => {
      expect(screen.getByText(/Agent Output/)).toBeInTheDocument();
    });

    // The JSON output should contain the WS result
    const pre = document.querySelector("pre");
    expect(pre?.textContent).toContain("WS Air");
  });

  it("handles initial fetch throwing exception silently", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error")
    );

    render(<SearchExecutionPage />);
    // Should render without crashing
    expect(screen.getByText("Flight Search")).toBeInTheDocument();
  });

  it("shows search params when fetched from initial load", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ id: "f1", airline: "TestAir", price: 400 }],
        searchParams: {
          origin: "JFK",
          destination: "LHR",
          departureDate: "2026-04-10",
          returnDate: "2026-04-20",
          cabinClass: "business",
          directOnly: true,
        },
      }),
    });

    mockUseSearchExecution.mockReturnValue({
      status: "completed",
      events: [],
      error: undefined,
      results: [],
      retry: mockRetry,
    });

    render(<SearchExecutionPage />);
    // Agent output section should show the searchParams and flights
    await waitFor(() => {
      expect(screen.getByText(/Agent Output/)).toBeInTheDocument();
    });
  });

  it("does not show Agent Output when still running", () => {
    mockUseSearchExecution.mockReturnValue({
      status: "running",
      events: [],
      error: undefined,
      results: undefined,
      retry: mockRetry,
    });
    render(<SearchExecutionPage />);
    expect(screen.queryByText(/Agent Output/)).not.toBeInTheDocument();
  });
});
