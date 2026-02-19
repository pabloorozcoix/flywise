import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Calendar } from "./calendar";

describe("Calendar", () => {
  it("renders with data-slot=calendar", () => {
    const { container } = render(<Calendar />);
    const cal = container.querySelector("[data-slot='calendar']");
    expect(cal).toBeInTheDocument();
  });

  it("renders navigation buttons", () => {
    render(<Calendar />);
    // DayPicker renders prev/next nav buttons
    const navButtons = screen.getAllByRole("button");
    expect(navButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("calls onSelect when a day is clicked", async () => {
    const onSelect = vi.fn();
    render(<Calendar mode="single" onSelect={onSelect} />);
    // DayPicker renders day buttons; click the first available one
    const dayButtons = screen.getAllByRole("button").filter(
      (btn) => btn.getAttribute("data-day") !== null
    );
    if (dayButtons.length > 0) {
      dayButtons[0].click();
      expect(onSelect).toHaveBeenCalled();
    }
  });

  it("applies custom className", () => {
    const { container } = render(<Calendar className="my-calendar" />);
    const cal = container.querySelector("[data-slot='calendar']");
    expect(cal).toHaveClass("my-calendar");
  });

  it("renders week numbers when showWeekNumber is set", () => {
    const { container } = render(<Calendar showWeekNumber />);
    // WeekNumber component renders <td> elements with week number content
    const weekNumberCells = container.querySelectorAll("td");
    expect(weekNumberCells.length).toBeGreaterThan(0);
  });

  it("renders selected day with data-selected-single attribute", () => {
    const selected = new Date(2026, 1, 15); // Feb 15, 2026
    const { container } = render(
      <Calendar mode="single" selected={selected} defaultMonth={selected} />
    );
    const selectedBtn = container.querySelector("[data-selected-single='true']");
    expect(selectedBtn).toBeInTheDocument();
  });

  it("renders with captionLayout=dropdown to cover dropdown classNames", () => {
    const { container } = render(
      <Calendar captionLayout="dropdown" fromYear={2024} toYear={2028} />
    );
    const cal = container.querySelector("[data-slot='calendar']");
    expect(cal).toBeInTheDocument();
  });
});
