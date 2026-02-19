import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SystemStatus } from "./index";
import { systemHealthy, systemDegraded } from "@/__tests__/fixtures/apiResponses";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("SystemStatus", () => {
  it("renders check button", () => {
    render(<SystemStatus />);
    expect(screen.getByRole("button", { name: /Check All Services/i })).toBeInTheDocument();
  });

  it("shows All Healthy badge on healthy status", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => systemHealthy });

    const user = userEvent.setup();
    render(<SystemStatus />);

    await user.click(screen.getByRole("button", { name: /Check All Services/i }));

    await screen.findByText("All Healthy");
    expect(screen.getByText("Ollama")).toBeInTheDocument();
    expect(screen.getByText("Browser-Use")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
  });

  it("shows service latency", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => systemHealthy });

    const user = userEvent.setup();
    render(<SystemStatus />);

    await user.click(screen.getByRole("button", { name: /Check All Services/i }));

    await screen.findByText("42ms");
  });

  it("shows table counts", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => systemHealthy });

    const user = userEvent.setup();
    render(<SystemStatus />);

    await user.click(screen.getByRole("button", { name: /Check All Services/i }));

    await screen.findByText("48 rows");
  });

  it("shows Degraded badge on degraded status", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => systemDegraded });

    const user = userEvent.setup();
    render(<SystemStatus />);

    await user.click(screen.getByRole("button", { name: /Check All Services/i }));

    await screen.findByText("Degraded");
  });

  it("shows 'not found' for negative table count", async () => {
    const statusWithNegativeCount = {
      ...systemHealthy,
      tableCounts: { agent_ctx: -1, agent_state: 5, flight_results: 0, memory: 10 },
    };
    mockFetch.mockResolvedValue({ ok: true, json: async () => statusWithNegativeCount });

    const user = userEvent.setup();
    render(<SystemStatus />);
    await user.click(screen.getByRole("button", { name: /Check All Services/i }));

    await screen.findByText("not found");
    expect(screen.getByText("5 rows")).toBeInTheDocument();
  });

  it("shows error on fetch failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });

    const user = userEvent.setup();
    render(<SystemStatus />);

    await user.click(screen.getByRole("button", { name: /Check All Services/i }));

    await screen.findByText("Failed to fetch system status");
    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});
