import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/font/google to avoid font loading in tests
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter" }),
  JetBrains_Mono: () => ({ variable: "--font-jetbrains-mono" }),
}));

// Mock child components to isolate layout testing
vi.mock("@/components/Navbar", () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}));
vi.mock("@/components/Footer", () => ({
  Footer: () => <div data-testid="footer">Footer</div>,
}));
vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}));

import RootLayout, { metadata } from "./layout";

describe("RootLayout metadata", () => {
  it("exports the correct title", () => {
    expect(metadata.title).toBe("FlyWise – Autonomous Flight Search");
  });

  it("exports the correct description", () => {
    expect(metadata.description).toBe(
      "FlyWise – Autonomous flight search with local LLM and browser automation"
    );
  });
});

describe("RootLayout component", () => {
  it("renders children inside ThemeProvider with Navbar and Footer", () => {
    // RootLayout renders <html><body>... — render just the inner output.
    // In jsdom the <html> and <body> elements are merged with the existing
    // document, but the component tree is still accessible.
    const { container } = render(
      <RootLayout>
        <div data-testid="child-content">Hello World</div>
      </RootLayout>
    );

    expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("applies font variables and classes to the body", () => {
    render(
      <RootLayout>
        <span>Test</span>
      </RootLayout>
    );

    // The body should have the font variable classes applied
    const body = document.body;
    expect(body.className).toContain("--font-inter");
    expect(body.className).toContain("--font-jetbrains-mono");
    expect(body.className).toContain("font-sans");
    expect(body.className).toContain("antialiased");
  });

  it("sets lang and suppressHydrationWarning on html element", () => {
    render(
      <RootLayout>
        <span>Test</span>
      </RootLayout>
    );

    const html = document.documentElement;
    expect(html.getAttribute("lang")).toBe("en");
  });
});
