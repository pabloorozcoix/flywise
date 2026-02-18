import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the Settings component since it's already unit-tested
vi.mock("@/components/settings", () => ({
  Settings: () => <div data-testid="mock-settings">Settings Component</div>,
}));

import SettingsPage from "./page";

describe("Settings page", () => {
  it("renders the Settings heading", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    render(<SettingsPage />);
    expect(
      screen.getByText("Service connectivity & diagnostics")
    ).toBeInTheDocument();
  });

  it("renders the Settings component", () => {
    render(<SettingsPage />);
    expect(screen.getByTestId("mock-settings")).toBeInTheDocument();
  });
});
