import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentStatus } from "./AgentStatus";

describe("AgentStatus", () => {
  it("renders idle state", () => {
    render(<AgentStatus status="idle" />);
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });

  it("renders connecting state", () => {
    render(<AgentStatus status="connecting" />);
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("renders running state", () => {
    render(<AgentStatus status="running" />);
    expect(screen.getByText("Agent is working...")).toBeInTheDocument();
  });

  it("renders completed state without results", () => {
    render(<AgentStatus status="completed" />);
    expect(screen.getByText("Search complete")).toBeInTheDocument();
  });

  it("renders completed state with results count", () => {
    render(
      <AgentStatus
        status="completed"
        results={[{ airline: "A" }, { airline: "B" }, { airline: "C" }]}
      />
    );

    expect(screen.getByText("Search complete")).toBeInTheDocument();
    expect(screen.getByText("3 flights found")).toBeInTheDocument();
  });

  it("renders singular 'flight' for 1 result", () => {
    render(
      <AgentStatus status="completed" results={[{ airline: "A" }]} />
    );
    expect(screen.getByText("1 flight found")).toBeInTheDocument();
  });

  it("renders error state with message", () => {
    render(<AgentStatus status="error" error="Something went wrong" />);
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders retry button on error with onRetry", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(
      <AgentStatus status="error" error="Failed" onRetry={onRetry} />
    );

    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();

    await user.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render retry button without onRetry", () => {
    render(<AgentStatus status="error" error="Failed" />);
    expect(screen.queryByRole("button", { name: /Retry/i })).not.toBeInTheDocument();
  });

  it("renders cancelled state", () => {
    render(<AgentStatus status="cancelled" />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("Search was terminated by user")).toBeInTheDocument();
  });
});
