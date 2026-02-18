import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Label } from "./label";

describe("Label", () => {
  it("renders with data-slot", () => {
    render(<Label>Username</Label>);
    const el = screen.getByText("Username");
    expect(el).toHaveAttribute("data-slot", "label");
  });

  it("applies htmlFor prop", () => {
    render(<Label htmlFor="my-input">Email</Label>);
    expect(screen.getByText("Email")).toHaveAttribute("for", "my-input");
  });

  it("applies custom className", () => {
    render(<Label className="custom-label">Name</Label>);
    expect(screen.getByText("Name")).toHaveClass("custom-label");
  });
});
