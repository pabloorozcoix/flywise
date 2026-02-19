import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Settings } from "./index";

describe("Settings", () => {
  it("renders four tabs", () => {
    render(<Settings />);
    expect(screen.getByRole("tab", { name: /Ollama/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Database/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Browser-Use/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /System/i })).toBeInTheDocument();
  });

  it("shows Ollama tab content by default", () => {
    render(<Settings />);
    // The OllamaConnectionTest card has "Test connectivity to the local Ollama" description
    expect(screen.getByText(/Test connectivity to the local Ollama/i)).toBeInTheDocument();
  });
});
