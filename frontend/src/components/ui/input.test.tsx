import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./input";

describe("Input", () => {
  it("renders with data-slot", () => {
    render(<Input data-testid="input" />);
    const el = screen.getByTestId("input");
    expect(el).toHaveAttribute("data-slot", "input");
    expect(el.tagName).toBe("INPUT");
  });

  it("applies type prop", () => {
    render(<Input type="password" data-testid="pwd" />);
    expect(screen.getByTestId("pwd")).toHaveAttribute("type", "password");
  });

  it("applies placeholder", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Input className="custom-input" data-testid="inp" />);
    expect(screen.getByTestId("inp")).toHaveClass("custom-input");
  });

  it("forwards disabled prop", () => {
    render(<Input disabled data-testid="dis" />);
    expect(screen.getByTestId("dis")).toBeDisabled();
  });
});
