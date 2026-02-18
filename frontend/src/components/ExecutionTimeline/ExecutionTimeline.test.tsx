import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExecutionTimeline } from "./ExecutionTimeline";
import {
  emptyEvents,
  statusEvents,
  progressEvents,
  completedEvents,
  errorEvents,
  cancelledEvents,
  progressWithMemoryEvents,
  progressThenStatusEvents,
  progressWithDataScreenshotOnly,
  progressWithNoStep,
} from "@/__tests__/fixtures/agentEvents";

describe("ExecutionTimeline", () => {
  it("renders waiting spinner when events are empty", () => {
    render(<ExecutionTimeline events={emptyEvents} />);
    expect(screen.getByText("Waiting for agent to start...")).toBeInTheDocument();
  });

  it("renders status events", () => {
    render(<ExecutionTimeline events={statusEvents} />);
    expect(screen.getByText("Connecting to agent...")).toBeInTheDocument();
    expect(screen.getByText("Connected — starting search")).toBeInTheDocument();
  });

  it("renders progress events with messages", () => {
    render(<ExecutionTimeline events={progressEvents} />);
    expect(screen.getByText("Step 1: Navigating to Google Flights")).toBeInTheDocument();
    expect(screen.getByText("Step 2: Filling search form")).toBeInTheDocument();
  });

  it("renders completed event", () => {
    render(<ExecutionTimeline events={completedEvents} />);
    expect(screen.getByText("Search complete")).toBeInTheDocument();
  });

  it("renders error event", () => {
    render(<ExecutionTimeline events={errorEvents} />);
    expect(screen.getByText("Agent encountered an error: timeout")).toBeInTheDocument();
  });

  it("renders cancelled event", () => {
    render(<ExecutionTimeline events={cancelledEvents} />);
    expect(screen.getByText("Search cancelled by user")).toBeInTheDocument();
  });

  it("shows URL when progress event has one", () => {
    render(<ExecutionTimeline events={progressEvents} />);
    // Both progress events share the same URL — verify at least one is rendered
    const urls = screen.getAllByText(/Interacting with/);
    expect(urls.length).toBeGreaterThan(0);
  });

  it("expands progress event details on click", async () => {
    const user = userEvent.setup();
    render(<ExecutionTimeline events={progressEvents} />);

    // Find the button for the progress event that has thinking data
    const eventButton = screen.getByText("Step 1: Navigating to Google Flights");
    await user.click(eventButton);

    expect(screen.getByText(/I need to search for flights/)).toBeInTheDocument();
    expect(screen.getByText(/Page loaded successfully/)).toBeInTheDocument();
  });

  it("shows memory section in expanded details", async () => {
    const user = userEvent.setup();
    render(<ExecutionTimeline events={progressWithMemoryEvents} />);

    const eventButton = screen.getByText("Step 1: With memory and screenshot");
    await user.click(eventButton);

    expect(screen.getByText(/Remembering search context/)).toBeInTheDocument();
    expect(screen.getByText("Memory:")).toBeInTheDocument();
  });

  it("shows screenshot in expanded details", async () => {
    const user = userEvent.setup();
    render(<ExecutionTimeline events={progressWithMemoryEvents} />);

    const eventButton = screen.getByText("Step 1: With memory and screenshot");
    await user.click(eventButton);

    const img = screen.getByAltText(/Screenshot — Step 1/);
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "data:image/png;base64,screenshot123");
  });

  it("shows dashed timeline line for last progress event when search not finished", () => {
    const { container } = render(
      <ExecutionTimeline events={progressThenStatusEvents} />
    );
    // The last progress event (index 1) should have dashed border since
    // it's the last progress, search isn't finished, and it's not the last event overall
    const dashedLines = container.querySelectorAll(".border-dashed");
    expect(dashedLines.length).toBeGreaterThan(0);
  });

  it("shows screenshot from data.screenshotUrl when event.screenshotUrl is absent", async () => {
    const user = userEvent.setup();
    render(<ExecutionTimeline events={progressWithDataScreenshotOnly} />);

    const eventButton = screen.getByText("Step 1: Data screenshot only");
    await user.click(eventButton);

    const img = screen.getByAltText(/Screenshot — Step 1/);
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "data:image/png;base64,datascreenshot456");
  });

  it("uses index+1 in screenshot alt when d.step is undefined", async () => {
    const user = userEvent.setup();
    render(<ExecutionTimeline events={progressWithNoStep} />);

    const eventButton = screen.getByText("Step without step number");
    await user.click(eventButton);

    // The progress event is at index 2 (after 2 status events), so alt = "Screenshot — Step 3"
    const img = screen.getByAltText(/Screenshot — Step 3/);
    expect(img).toBeInTheDocument();
  });

  it("collapses expanded event on second click", async () => {
    const user = userEvent.setup();
    render(<ExecutionTimeline events={progressWithMemoryEvents} />);

    const eventButton = screen.getByText("Step 1: With memory and screenshot");
    await user.click(eventButton);
    expect(screen.getByText(/Remembering search context/)).toBeInTheDocument();

    await user.click(eventButton);
    expect(screen.queryByText(/Remembering search context/)).not.toBeInTheDocument();
  });
});
