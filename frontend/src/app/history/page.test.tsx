import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({}),
  usePathname: () => "/history",
  useSearchParams: () => new URLSearchParams(),
}));

import HistoryPage from "./page";

describe("History page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders the History heading", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ executions: [] }),
    });

    render(<HistoryPage />);
    expect(screen.getByText("History")).toBeInTheDocument();
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/executions");
    });
  });

  it("renders the Dashboard link", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ executions: [] }),
    });

    render(<HistoryPage />);
    const link = screen.getByRole("link", { name: /Dashboard/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("shows loading state then ExecutionsTable with empty data", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ executions: [] }),
    });

    render(<HistoryPage />);
    await waitFor(() => {
      expect(screen.getByText(/Loading executions/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/No executions yet/i)).toBeInTheDocument();
    });
  });

  it("shows execution count when data is loaded", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        executions: [
          {
            searchId: "s1",
            origin: "JFK",
            destination: "LHR",
            departureDate: "2026-04-10",
            returnDate: null,
            cabinClass: "economy",
            directOnly: false,
            createdAt: "2026-02-19T12:00:00Z",
            status: "completed",
            errorMessage: null,
            startedAt: "2026-02-19T12:00:00Z",
            completedAt: "2026-02-19T12:05:00Z",
            resultCount: 5,
          },
        ],
      }),
    });

    render(<HistoryPage />);
    await waitFor(() => {
      expect(screen.getByText("1 search")).toBeInTheDocument();
    });
  });

  it("shows plural 'searches' when multiple executions", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        executions: [
          {
            searchId: "s1",
            origin: "JFK",
            destination: "LHR",
            departureDate: "2026-04-10",
            returnDate: null,
            cabinClass: "economy",
            directOnly: false,
            createdAt: "2026-02-19T12:00:00Z",
            status: "completed",
            errorMessage: null,
            startedAt: null,
            completedAt: null,
            resultCount: 0,
          },
          {
            searchId: "s2",
            origin: "LAX",
            destination: "CDG",
            departureDate: "2026-05-01",
            returnDate: null,
            cabinClass: "business",
            directOnly: true,
            createdAt: "2026-02-19T14:00:00Z",
            status: "running",
            errorMessage: null,
            startedAt: "2026-02-19T14:00:00Z",
            completedAt: null,
            resultCount: 0,
          },
        ],
      }),
    });

    render(<HistoryPage />);
    await waitFor(() => {
      expect(screen.getByText("2 searches")).toBeInTheDocument();
    });
  });

  it("shows error state when fetch fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error")
    );

    render(<HistoryPage />);
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });

  it("shows error state when response is not ok", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    render(<HistoryPage />);
    await waitFor(() => {
      expect(screen.getByText("Failed to load results")).toBeInTheDocument();
    });
  });

  it("calls window.location.reload when Retry is clicked", async () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadMock },
      writable: true,
      configurable: true,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Fetch failed")
    );

    render(<HistoryPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Retry/i }));
    expect(reloadMock).toHaveBeenCalled();
  });

  it("handles response with missing executions key by using empty array", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    render(<HistoryPage />);
    await waitFor(() => {
      expect(screen.getByText(/No executions yet/i)).toBeInTheDocument();
    });
  });

  it("shows error when json() throws", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    });

    render(<HistoryPage />);
    await waitFor(() => {
      expect(screen.getByText("Invalid JSON")).toBeInTheDocument();
    });
  });

  it("renders ExecutionsTable with data after successful fetch", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        executions: [
          {
            searchId: "s1",
            origin: "JFK",
            destination: "LHR",
            departureDate: "2026-04-10",
            returnDate: null,
            cabinClass: "economy",
            directOnly: false,
            createdAt: "2026-02-19T12:00:00Z",
            status: "completed",
            errorMessage: null,
            startedAt: null,
            completedAt: null,
            resultCount: 3,
          },
        ],
      }),
    });

    render(<HistoryPage />);
    await waitFor(() => {
      expect(screen.getByText("JFK")).toBeInTheDocument();
      expect(screen.getByText("LHR")).toBeInTheDocument();
    });
  });
});
