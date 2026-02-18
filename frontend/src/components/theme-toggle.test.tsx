import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./theme-toggle";

const mockSetTheme = vi.fn();
const mockUseTheme = vi.fn(() => ({
  theme: "dark",
  setTheme: mockSetTheme,
  resolvedTheme: "dark",
  themes: ["light", "dark"],
  forcedTheme: undefined,
  systemTheme: undefined,
}));

vi.mock("next-themes", () => ({
  useTheme: (...args: unknown[]) => mockUseTheme(...args),
}));

describe("ThemeToggle", () => {
  it("renders toggle button", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: /Toggle theme/i })).toBeInTheDocument();
  });

  it("calls setTheme to 'light' when current theme is dark", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const btn = screen.getByRole("button", { name: /Toggle theme/i });
    await user.click(btn);

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("calls setTheme to 'dark' when current theme is light", async () => {
    mockUseTheme.mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
      resolvedTheme: "light",
      themes: ["light", "dark"],
      forcedTheme: undefined,
      systemTheme: undefined,
    });

    const user = userEvent.setup();
    render(<ThemeToggle />);

    const btn = screen.getByRole("button", { name: /Toggle theme/i });
    await user.click(btn);

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });
});
