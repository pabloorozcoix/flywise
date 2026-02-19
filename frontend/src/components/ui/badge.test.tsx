import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders with default variant", () => {
    render(<Badge>Status</Badge>);
    const el = screen.getByText("Status");
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("data-slot", "badge");
    expect(el).toHaveAttribute("data-variant", "default");
  });

  it("renders outline variant", () => {
    render(<Badge variant="outline">Outline</Badge>);
    expect(screen.getByText("Outline")).toHaveAttribute("data-variant", "outline");
  });

  it("renders destructive variant", () => {
    render(<Badge variant="destructive">Error</Badge>);
    expect(screen.getByText("Error")).toHaveAttribute("data-variant", "destructive");
  });

  it("renders secondary variant", () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    expect(screen.getByText("Secondary")).toHaveAttribute("data-variant", "secondary");
  });

  it("applies custom className", () => {
    render(<Badge className="my-class">Custom</Badge>);
    expect(screen.getByText("Custom")).toHaveClass("my-class");
  });

  it("renders as child element when asChild is true", () => {
    render(
      <Badge asChild>
        <a href="/test">Link Badge</a>
      </Badge>
    );
    const link = screen.getByRole("link", { name: "Link Badge" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test");
  });
});
