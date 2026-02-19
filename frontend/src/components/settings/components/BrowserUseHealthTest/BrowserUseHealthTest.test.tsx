import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserUseHealthTest } from "./index";
import { browserUseHealthy } from "@/__tests__/fixtures/apiResponses";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("BrowserUseHealthTest", () => {
  it("renders test button", () => {
    render(<BrowserUseHealthTest />);
    expect(screen.getByRole("button", { name: /Test Browser-Use/i })).toBeInTheDocument();
  });

  it("shows Healthy badge on success", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => browserUseHealthy });

    const user = userEvent.setup();
    render(<BrowserUseHealthTest />);

    await user.click(screen.getByRole("button", { name: /Test Browser-Use/i }));

    await screen.findByText("Service is healthy");
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });

  it("shows error on failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Service down" }),
    });

    const user = userEvent.setup();
    render(<BrowserUseHealthTest />);

    await user.click(screen.getByRole("button", { name: /Test Browser-Use/i }));

    await screen.findByText("Service down");
    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});
