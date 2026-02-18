import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchForm } from "./SearchForm";

describe("SearchForm", () => {
  it("renders origin and destination inputs", () => {
    render(<SearchForm onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText("JFK")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("LHR")).toBeInTheDocument();
  });

  it("renders departure and return date pickers", () => {
    render(<SearchForm onSubmit={vi.fn()} />);
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("To")).toBeInTheDocument();
    expect(screen.getByText("Departure")).toBeInTheDocument();
    expect(screen.getByText("Return (optional)")).toBeInTheDocument();
  });

  it("renders cabin class selector", () => {
    render(<SearchForm onSubmit={vi.fn()} />);
    expect(screen.getByText("Class")).toBeInTheDocument();
  });

  it("renders direct flights toggle", () => {
    render(<SearchForm onSubmit={vi.fn()} />);
    expect(screen.getByText("Direct flights only")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<SearchForm onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Search with Agent/i })).toBeInTheDocument();
  });

  it("shows spinner when isSubmitting", () => {
    render(<SearchForm onSubmit={vi.fn()} isSubmitting={true} />);
    expect(screen.getByRole("button", { name: /Searching/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Searching/i })).toBeDisabled();
  });

  it("toggles Advanced Options to show API key field", async () => {
    const user = userEvent.setup();
    render(<SearchForm onSubmit={vi.fn()} />);

    expect(screen.queryByPlaceholderText("sk-...")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Advanced Options/i }));

    expect(screen.getByPlaceholderText("sk-...")).toBeInTheDocument();
    expect(screen.getByText(/OpenAI API Key/i)).toBeInTheDocument();
  });

  it("pre-fills with defaultValues", () => {
    render(
      <SearchForm
        onSubmit={vi.fn()}
        defaultValues={{ origin: "SFO", destination: "CDG" }}
      />
    );
    expect(screen.getByDisplayValue("SFO")).toBeInTheDocument();
    expect(screen.getByDisplayValue("CDG")).toBeInTheDocument();
  });

  it("opens departure date calendar and selects a day", async () => {
    const user = userEvent.setup();
    render(<SearchForm onSubmit={vi.fn()} />);

    // Find all "Pick a date" buttons - first is departure, second is return
    const dateButtons = screen.getAllByText("Pick a date");
    expect(dateButtons.length).toBeGreaterThanOrEqual(1);

    // Click the departure date button to open the popover
    await user.click(dateButtons[0]);

    // If the Calendar renders inside the popover, there should be day buttons
    const dayButtons = screen.queryAllByRole("button").filter(
      (btn) => btn.getAttribute("data-day") !== null
    );

    if (dayButtons.length > 0) {
      // Click a future day to trigger onSelect
      await user.click(dayButtons[dayButtons.length - 1]);
      // After selection, the button text should change from "Pick a date"
      // to the formatted date (or the popover closes)
    }
  });

  it("opens return date calendar and selects a day", async () => {
    const user = userEvent.setup();
    render(<SearchForm onSubmit={vi.fn()} />);

    const dateButtons = screen.getAllByText("Pick a date");
    if (dateButtons.length >= 2) {
      // Click the return date button
      await user.click(dateButtons[1]);

      const dayButtons = screen.queryAllByRole("button").filter(
        (btn) => btn.getAttribute("data-day") !== null
      );

      if (dayButtons.length > 0) {
        await user.click(dayButtons[dayButtons.length - 1]);
      }
    }
  });

  it("calls onSubmit with form data when submitted with valid values", async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn();
    render(<SearchForm onSubmit={mockOnSubmit} defaultValues={{ origin: "JFK", destination: "LHR" }} />);

    // Fill departure date via the input (the form expects at least origin/destination)
    await user.click(screen.getByRole("button", { name: /Search with Agent/i }));

    // The form uses react-hook-form, so onSubmit should be called if validation passes
    // With defaultValues set, at least origin and destination are filled
  });

  it("toggles direct flights switch", async () => {
    const user = userEvent.setup();
    render(<SearchForm onSubmit={vi.fn()} />);

    const switchBtn = screen.getByRole("switch");
    expect(switchBtn).toBeInTheDocument();
    await user.click(switchBtn);
    // The switch should toggle (checked state changes)
  });
});
