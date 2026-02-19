import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "./theme-provider";

describe("ThemeProvider", () => {
  it("renders children", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark">
        <div>Child content</div>
      </ThemeProvider>
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });
});
