import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mock useFlightSearch before the component is imported ──
const mockSubmitSearch = vi.fn();
const mockUseFlightSearch = vi.fn(() => ({
  submitSearch: mockSubmitSearch,
  isSubmitting: false,
  error: null as string | null,
}));

vi.mock("@/components/SearchForm/hooks/useFlightSearch", () => ({
  useFlightSearch: () => mockUseFlightSearch(),
}));

import Home from "./page";

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFlightSearch.mockReturnValue({
      submitSearch: mockSubmitSearch,
      isSubmitting: false,
      error: null,
    });
  });

  it("renders the hero heading", () => {
    render(<Home />);
    expect(screen.getByText(/Fly Smarter/i)).toBeInTheDocument();
    expect(screen.getByText(/do the hunting/i)).toBeInTheDocument();
  });

  it("renders the hero badge text", () => {
    render(<Home />);
    expect(screen.getByText(/The Next Generation of Travel/i)).toBeInTheDocument();
  });

  it("renders the hero subtitle", () => {
    render(<Home />);
    expect(
      screen.getByText(/AeroAgent AI uses advanced machine learning/i)
    ).toBeInTheDocument();
  });

  it("renders the SearchForm component", () => {
    render(<Home />);
    // SearchForm renders a heading h3 "Search with Agent"
    expect(screen.getByRole("heading", { name: /Search with Agent/i })).toBeInTheDocument();
  });

  it("renders the trust indicator", () => {
    render(<Home />);
    expect(
      screen.getByText(/AI Agent currently scanning 450\+ airlines/i)
    ).toBeInTheDocument();
  });

  it("renders the features grid", () => {
    render(<Home />);
    expect(screen.getByText("Autonomous Booking Power")).toBeInTheDocument();
    expect(screen.getByText("AI Price Negotiation")).toBeInTheDocument();
    expect(screen.getByText("Multi-Hop Optimization")).toBeInTheDocument();
    expect(screen.getByText("Concierge Monitoring")).toBeInTheDocument();
  });

  it("does NOT render error when there is none", () => {
    render(<Home />);
    // No error container should be present
    const errorEl = document.querySelector(".text-red-400");
    expect(errorEl).toBeNull();
  });

  it("renders error message when useFlightSearch returns one", () => {
    mockUseFlightSearch.mockReturnValue({
      submitSearch: mockSubmitSearch,
      isSubmitting: false,
      error: "Something went wrong",
    });
    render(<Home />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("passes submitSearch to SearchForm", () => {
    render(<Home />);
    // The submit button should be present (not the "Searching..." variant)
    expect(
      screen.getByRole("button", { name: /Search with Agent/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Search with Agent/i })
    ).not.toBeDisabled();
  });

  it("shows submitting state when isSubmitting is true", () => {
    mockUseFlightSearch.mockReturnValue({
      submitSearch: mockSubmitSearch,
      isSubmitting: true,
      error: null,
    });
    render(<Home />);
    expect(
      screen.getByRole("button", { name: /Searching/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Searching/i })).toBeDisabled();
  });
});
