import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navbar } from "./Navbar";

// Override usePathname per test
vi.mock("next/navigation", async () => {
  const actual = await vi.importActual("next/navigation");
  return {
    ...actual,
    usePathname: () => "/",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
    useParams: () => ({}),
    useSearchParams: () => new URLSearchParams(),
  };
});

describe("Navbar", () => {
  it("renders the logo text", () => {
    render(<Navbar />);
    expect(screen.getByText("Fly")).toBeInTheDocument();
    expect(screen.getByText("Wise")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(<Navbar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Credits")).toBeInTheDocument();
  });

  it("renders LIVE indicator", () => {
    render(<Navbar />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("applies className prop", () => {
    const { container } = render(<Navbar className="custom-class" />);
    const header = container.querySelector("header");
    expect(header?.className).toContain("custom-class");
  });
});
