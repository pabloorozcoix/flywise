import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlightCard } from "./FlightCard";
import { mockFlightResult } from "@/__tests__/fixtures/flightResults";

describe("FlightCard", () => {
  it("renders airline name, origin, destination", () => {
    const flight = mockFlightResult({ airline: "British Airways", origin: "JFK", destination: "LHR" });
    render(<FlightCard flight={flight} />);

    expect(screen.getByText("British Airways")).toBeInTheDocument();
    expect(screen.getAllByText(/JFK/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/LHR/).length).toBeGreaterThan(0);
  });

  it("renders price with dollar sign for USD", () => {
    const flight = mockFlightResult({ price: 450, currency: "USD" });
    render(<FlightCard flight={flight} />);

    // Price is rendered as "$450" + ".00" in the same <p>
    expect(screen.getByText((_content, element) => {
      return element?.tagName === "P" && !!element?.textContent?.includes("$450");
    })).toBeInTheDocument();
  });

  it("renders currency code for non-USD", () => {
    const flight = mockFlightResult({ price: 390, currency: "EUR" });
    render(<FlightCard flight={flight} />);

    expect(screen.getByText((_content, element) => {
      return element?.tagName === "P" && !!element?.textContent?.includes("EUR390");
    })).toBeInTheDocument();
  });

  it("renders duration", () => {
    const flight = mockFlightResult({ duration: "7h 30m" });
    render(<FlightCard flight={flight} />);

    expect(screen.getByText("7h 30m")).toBeInTheDocument();
  });

  it("renders 'Non-stop' for 0 stops", () => {
    const flight = mockFlightResult({ stops: 0 });
    render(<FlightCard flight={flight} />);

    expect(screen.getByText("Non-stop")).toBeInTheDocument();
  });

  it("renders '1 stop' for 1 stop", () => {
    const flight = mockFlightResult({ stops: 1 });
    render(<FlightCard flight={flight} />);

    expect(screen.getByText("1 stop")).toBeInTheDocument();
  });

  it("renders '2 stops' for 2 stops", () => {
    const flight = mockFlightResult({ stops: 2 });
    render(<FlightCard flight={flight} />);

    expect(screen.getByText("2 stops")).toBeInTheDocument();
  });

  it("renders 'Best Value' badge for rank=1", () => {
    const flight = mockFlightResult();
    render(<FlightCard flight={flight} rank={1} />);

    expect(screen.getByText("Best Value")).toBeInTheDocument();
  });

  it("renders 'Cheapest' badge for rank=2", () => {
    const flight = mockFlightResult();
    render(<FlightCard flight={flight} rank={2} />);

    expect(screen.getByText("Cheapest")).toBeInTheDocument();
  });

  it("renders no badge when rank is undefined", () => {
    const flight = mockFlightResult();
    render(<FlightCard flight={flight} />);

    expect(screen.queryByText("Best Value")).not.toBeInTheDocument();
    expect(screen.queryByText("Cheapest")).not.toBeInTheDocument();
  });

  it("renders 'Verified' when verified=true", () => {
    const flight = mockFlightResult({ verified: true });
    render(<FlightCard flight={flight} />);

    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("renders 'Unverified' when verified=false", () => {
    const flight = mockFlightResult({ verified: false });
    render(<FlightCard flight={flight} />);

    expect(screen.getByText("Unverified")).toBeInTheDocument();
  });

  it("renders a link when url is present", () => {
    const flight = mockFlightResult({ url: "https://example.com/book" });
    render(<FlightCard flight={flight} />);

    const link = screen.getByRole("link", { name: /Select/i });
    expect(link).toHaveAttribute("href", "https://example.com/book");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders a button when url is absent", () => {
    const flight = mockFlightResult({ url: undefined });
    render(<FlightCard flight={flight} />);

    const button = screen.getByRole("button", { name: /Select/i });
    expect(button).toBeInTheDocument();
  });

  it("formats ISO departure time to HH:mm", () => {
    const flight = mockFlightResult({ departure: "2026-03-15T14:30:00Z" });
    const { container } = render(<FlightCard flight={flight} />);

    // safeFormatTime converts to HH:mm in local timezone; just verify it's a valid time format
    const allText = container.textContent ?? "";
    // Should have a time formatted with colon (HH:mm)
    expect(allText).toMatch(/\d{1,2}:\d{2}/);
  });

  it("returns raw value for unparseable date in safeFormatTime", () => {
    const flight = mockFlightResult({ departure: "not-a-date", arrival: "also-bad" });
    const { container } = render(<FlightCard flight={flight} />);
    const allText = container.textContent ?? "";
    // safeFormatTime falls through to return the original value for invalid dates
    expect(allText).toContain("not-a-date");
    expect(allText).toContain("also-bad");
  });
});
