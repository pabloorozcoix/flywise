import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OllamaConnectionTest } from "./index";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("OllamaConnectionTest", () => {
  it("renders test button", () => {
    render(<OllamaConnectionTest />);
    expect(screen.getByRole("button", { name: /Test Ollama/i })).toBeInTheDocument();
  });

  it("renders card title and description", () => {
    render(<OllamaConnectionTest />);
    expect(screen.getByText("Ollama LLM")).toBeInTheDocument();
    expect(screen.getByText(/Test connectivity to the local Ollama/i)).toBeInTheDocument();
  });

  it("shows Connected badge on success", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("Hello from Ollama"));
        controller.close();
      },
    });
    mockFetch.mockResolvedValue({ ok: true, body: stream });

    const user = userEvent.setup();
    render(<OllamaConnectionTest />);

    await user.click(screen.getByRole("button", { name: /Test Ollama/i }));

    // Wait for stream
    await screen.findByText("Hello from Ollama");
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows Error badge on failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Connection refused" }),
    });

    const user = userEvent.setup();
    render(<OllamaConnectionTest />);

    await user.click(screen.getByRole("button", { name: /Test Ollama/i }));

    await screen.findByText("Connection refused");
    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});
