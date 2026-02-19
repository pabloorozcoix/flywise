import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "./switch";

describe("Switch", () => {
  it("renders with data-slot", () => {
    render(<Switch aria-label="Toggle" />);
    const el = screen.getByRole("switch");
    expect(el).toHaveAttribute("data-slot", "switch");
  });

  it("defaults to unchecked", () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "unchecked");
  });

  it("renders checked when prop is set", () => {
    render(<Switch aria-label="Toggle" checked onCheckedChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "checked");
  });

  it("calls onCheckedChange on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch aria-label="Toggle" onCheckedChange={onChange} />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("is disabled when prop is set", () => {
    render(<Switch aria-label="Toggle" disabled />);
    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("applies custom className", () => {
    render(<Switch aria-label="Toggle" className="my-switch" />);
    expect(screen.getByRole("switch")).toHaveClass("my-switch");
  });
});
