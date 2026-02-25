import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/history",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

import type { ExecutionRow } from "@/lib/types/execution";
import { ExecutionsTable } from "./ExecutionsTable";

const mockExecution: ExecutionRow = {
  searchId: "search-1",
  origin: "JFK",
  destination: "LHR",
  departureDate: "2026-04-10",
  returnDate: "2026-04-20",
  cabinClass: "economy",
  directOnly: false,
  createdAt: "2026-02-19T12:00:00Z",
  status: "completed",
  errorMessage: null,
  startedAt: "2026-02-19T12:00:00Z",
  completedAt: "2026-02-19T12:05:00Z",
  resultCount: 5,
};

const mockExecutions: ExecutionRow[] = [
  mockExecution,
  {
    ...mockExecution,
    searchId: "search-2",
    origin: "LAX",
    destination: "CDG",
    departureDate: "2026-05-01",
    returnDate: null,
    cabinClass: "business",
    directOnly: true,
    status: "running",
    resultCount: 0,
  },
];

describe("ExecutionsTable", () => {
  it("shows loading state when loading is true", () => {
    render(<ExecutionsTable data={[]} loading={true} />);
    expect(screen.getByText(/Loading executions/i)).toBeInTheDocument();
  });

  it("shows empty state when not loading and data is empty", () => {
    render(<ExecutionsTable data={[]} loading={false} />);
    expect(screen.getByText("No executions yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Run a flight search from the dashboard/i)
    ).toBeInTheDocument();
  });

  it("renders table with data when not loading", () => {
    render(<ExecutionsTable data={[mockExecution]} loading={false} />);
    expect(screen.getByText(/JFK/)).toBeInTheDocument();
    expect(screen.getByText(/LHR/)).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders route as origin → destination", () => {
    render(<ExecutionsTable data={[mockExecution]} loading={false} />);
    const cell = screen.getByText(/JFK/).closest("td");
    expect(cell).toHaveTextContent("JFK");
    expect(cell).toHaveTextContent("LHR");
  });

  it("renders Timeline and Results links for each row", () => {
    render(<ExecutionsTable data={[mockExecution]} loading={false} />);
    const timelineLink = screen.getByRole("link", { name: "Timeline" });
    const resultsLink = screen.getByRole("link", { name: "Results" });
    expect(timelineLink).toHaveAttribute("href", "/history/search-1");
    expect(resultsLink).toHaveAttribute("href", "/results/search-1");
  });

  it("renders table headers", () => {
    render(<ExecutionsTable data={[mockExecution]} loading={false} />);
    expect(screen.getByText("Route")).toBeInTheDocument();
    expect(screen.getByText("Departure")).toBeInTheDocument();
    expect(screen.getByText("Return")).toBeInTheDocument();
    expect(screen.getByText("Cabin")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Results")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
  });

  it("shows — for missing return date", () => {
    const noReturn = { ...mockExecution, returnDate: null };
    render(<ExecutionsTable data={[noReturn]} loading={false} />);
    const row = screen.getByText(/JFK/).closest("tr");
    expect(row).toHaveTextContent("—");
  });

  it("shows — for zero result count", () => {
    const zeroResults = { ...mockExecution, resultCount: 0 };
    render(<ExecutionsTable data={[zeroResults]} loading={false} />);
    expect(screen.getByText(/JFK/)).toBeInTheDocument();
    const resultsCells = screen.getAllByRole("cell").filter((c) => c.textContent?.trim() === "—");
    expect(resultsCells.length).toBeGreaterThanOrEqual(1);
  });

  it("renders pagination controls when data length > default page size", async () => {
    const manyRows: ExecutionRow[] = Array.from({ length: 15 }, (_, i) => ({
      ...mockExecution,
      searchId: `search-${i}`,
      origin: `ORIGIN-${i}`,
      destination: `DEST-${i}`,
    }));
    render(<ExecutionsTable data={manyRows} loading={false} />);
    expect(screen.getByText(/Rows per page/i)).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
  });

  it("shows rows per page select when data is present", () => {
    const manyRows: ExecutionRow[] = Array.from({ length: 25 }, (_, i) => ({
      ...mockExecution,
      searchId: `search-${i}`,
      origin: `ORIGIN-${i}`,
      destination: `DEST-${i}`,
    }));
    render(<ExecutionsTable data={manyRows} loading={false} />);
    expect(screen.getByText(/Rows per page/i)).toBeInTheDocument();
    expect(screen.getByText(/of 25/)).toBeInTheDocument();
  });

  it("shows single page when data fits in one page", () => {
    render(<ExecutionsTable data={mockExecutions} loading={false} />);
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    expect(screen.getByText(/1–2/)).toBeInTheDocument();
    expect(screen.getByText(/of 2/)).toBeInTheDocument();
  });

  it("shows status badge for different statuses", () => {
    render(<ExecutionsTable data={mockExecutions} loading={false} />);
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });

  it("formats dates in table cells", () => {
    render(<ExecutionsTable data={[mockExecution]} loading={false} />);
    const d = new Date("2026-04-10");
    const expectedShort = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    expect(screen.getByText(expectedShort)).toBeInTheDocument();
  });

  it("does not render delete button when onDelete is not provided", () => {
    render(<ExecutionsTable data={[mockExecution]} loading={false} />);
    expect(screen.queryByTitle("Delete")).not.toBeInTheDocument();
  });

  it("renders delete button when onDelete is provided", () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<ExecutionsTable data={[mockExecution]} loading={false} onDelete={onDelete} />);
    expect(screen.getByTitle("Delete")).toBeInTheDocument();
  });

  it("shows confirmation dialog when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<ExecutionsTable data={[mockExecution]} loading={false} onDelete={onDelete} />);

    await user.click(screen.getByTitle("Delete"));

    expect(screen.getByText("Delete this search?")).toBeInTheDocument();
    const description = screen.getByText(/permanently delete the search/i);
    expect(description).toBeInTheDocument();
    expect(within(description).getByText(/JFK → LHR/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("calls onDelete when confirmation dialog Delete is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<ExecutionsTable data={[mockExecution]} loading={false} onDelete={onDelete} />);

    await user.click(screen.getByTitle("Delete"));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledWith("search-1");
  });

  it("does not call onDelete when Cancel is clicked in confirmation dialog", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<ExecutionsTable data={[mockExecution]} loading={false} onDelete={onDelete} />);

    await user.click(screen.getByTitle("Delete"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("renders delete button for each row", () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<ExecutionsTable data={mockExecutions} loading={false} onDelete={onDelete} />);
    const deleteButtons = screen.getAllByTitle("Delete");
    expect(deleteButtons).toHaveLength(2);
  });
});
