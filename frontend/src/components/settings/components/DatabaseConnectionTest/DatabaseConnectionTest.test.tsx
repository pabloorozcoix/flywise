import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatabaseConnectionTest } from "./index";
import { dbConnected, pgvectorActive } from "@/__tests__/fixtures/apiResponses";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("DatabaseConnectionTest", () => {
  it("renders both test buttons", () => {
    render(<DatabaseConnectionTest />);
    expect(screen.getByRole("button", { name: /Test Database/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Test pgvector/i })).toBeInTheDocument();
  });

  it("shows Connected badge on DB success", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => dbConnected });

    const user = userEvent.setup();
    render(<DatabaseConnectionTest />);

    await user.click(screen.getByRole("button", { name: /Test Database/i }));

    await screen.findByText("Connection successful");
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows pgvector result", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => pgvectorActive });

    const user = userEvent.setup();
    render(<DatabaseConnectionTest />);

    await user.click(screen.getByRole("button", { name: /Test pgvector/i }));

    await screen.findByText("pgvector extension active");
  });

  it("shows error on failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "DB unavailable" }),
    });

    const user = userEvent.setup();
    render(<DatabaseConnectionTest />);

    await user.click(screen.getByRole("button", { name: /Test Database/i }));

    await screen.findByText("DB unavailable");
    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});
