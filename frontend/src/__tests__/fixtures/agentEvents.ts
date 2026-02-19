import type { AgentEvent } from "@/lib/types/agentEvent";

let counter = 0;

export function mockAgentEvent(
  overrides: Partial<AgentEvent> = {}
): AgentEvent {
  counter++;
  return {
    id: `evt-${counter}`,
    timestamp: new Date(Date.now() + counter * 1000).toISOString(),
    type: "status",
    message: `Event ${counter}`,
    ...overrides,
  };
}

/** Status-only events chain */
export const statusEvents: AgentEvent[] = [
  mockAgentEvent({ id: "e-1", type: "status", message: "Connecting to agent..." }),
  mockAgentEvent({ id: "e-2", type: "status", message: "Connected — starting search" }),
];

/** Progress events chain */
export const progressEvents: AgentEvent[] = [
  ...statusEvents,
  mockAgentEvent({
    id: "e-3",
    type: "progress",
    message: "Step 1: Navigating to Google Flights",
    data: {
      step: 1,
      url: "https://flights.google.com",
      thinking: "I need to search for flights",
      evaluation: "Page loaded successfully",
      actions: [{ type: "click", selector: "#search" }],
    },
  }),
  mockAgentEvent({
    id: "e-4",
    type: "progress",
    message: "Step 2: Filling search form",
    data: {
      step: 2,
      url: "https://flights.google.com",
      thinking: "Entering origin and destination",
      screenshotUrl: "data:image/png;base64,abc123",
    },
  }),
];

/** Completed event chain */
export const completedEvents: AgentEvent[] = [
  ...progressEvents,
  mockAgentEvent({ id: "e-5", type: "done", message: "Search complete" }),
];

/** Error event chain */
export const errorEvents: AgentEvent[] = [
  ...statusEvents,
  mockAgentEvent({
    id: "e-err",
    type: "error",
    message: "Agent encountered an error: timeout",
  }),
];

/** Cancelled event chain */
export const cancelledEvents: AgentEvent[] = [
  ...progressEvents,
  mockAgentEvent({
    id: "e-cancel",
    type: "cancelled",
    message: "Search cancelled by user",
  }),
];

/** Empty events — waiting state */
export const emptyEvents: AgentEvent[] = [];

/** Progress followed by status — last progress is NOT the last event and search is unfinished */
export const progressThenStatusEvents: AgentEvent[] = [
  mockAgentEvent({ id: "e-pts-1", type: "status", message: "Connecting to agent..." }),
  mockAgentEvent({
    id: "e-pts-2",
    type: "progress",
    message: "Step 1: Navigating",
    data: { step: 1, url: "https://flights.google.com" },
  }),
  mockAgentEvent({ id: "e-pts-3", type: "status", message: "Reconnecting..." }),
];

/** Progress events with memory, screenshot, and actions for expanded details */
export const progressWithMemoryEvents: AgentEvent[] = [
  ...statusEvents,
  mockAgentEvent({
    id: "e-mem-1",
    type: "progress",
    message: "Step 1: With memory and screenshot",
    screenshotUrl: "data:image/png;base64,screenshot123",
    data: {
      step: 1,
      url: "https://flights.google.com",
      thinking: "Thinking about flights",
      evaluation: "Evaluating results",
      memory: "Remembering search context",
      actions: [{ type: "click", selector: "#btn" }],
      screenshotUrl: "data:image/png;base64,screenshot123",
    },
  }),
];

/** Progress event where only data.screenshotUrl is set (event.screenshotUrl is undefined) */
export const progressWithDataScreenshotOnly: AgentEvent[] = [
  ...statusEvents,
  mockAgentEvent({
    id: "e-dss-1",
    type: "progress",
    message: "Step 1: Data screenshot only",
    // screenshotUrl NOT set on event level
    data: {
      step: 1,
      url: "https://flights.google.com",
      thinking: "Checking data screenshot fallback",
      evaluation: "Testing fallback",
      screenshotUrl: "data:image/png;base64,datascreenshot456",
    },
  }),
];

/** Progress event where d.step is undefined — tests index+1 fallback in screenshot alt */
export const progressWithNoStep: AgentEvent[] = [
  ...statusEvents,
  mockAgentEvent({
    id: "e-nostep-1",
    type: "progress",
    message: "Step without step number",
    screenshotUrl: "data:image/png;base64,nostep123",
    data: {
      // step is intentionally omitted
      url: "https://flights.google.com",
      thinking: "Thinking",
      evaluation: "Evaluating",
    },
  }),
];
