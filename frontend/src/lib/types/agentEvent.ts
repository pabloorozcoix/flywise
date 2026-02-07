/**
 * Types for agent execution events streamed via WebSocket.
 */

/** Event types emitted by the browser-use agent */
export type AgentEventType = "status" | "progress" | "done" | "error";

/** A single event from the agent execution timeline */
export interface AgentEvent {
  /** Unique event identifier */
  id: string;
  /** ISO timestamp of when the event occurred */
  timestamp: string;
  /** Type of event */
  type: AgentEventType;
  /** Human-readable description of what happened */
  message: string;
  /** Optional screenshot URL/data URI captured during this step */
  screenshotUrl?: string;
  /** Optional structured data (e.g., results on "done") */
  data?: Record<string, unknown>;
}

/** Status of an agent search execution */
export type SearchExecutionStatus = "idle" | "connecting" | "running" | "completed" | "error";

/** The full state of a search execution */
export interface SearchExecutionState {
  /** Current status */
  status: SearchExecutionStatus;
  /** Timeline of events */
  events: AgentEvent[];
  /** Error message if status is "error" */
  error?: string;
  /** Flight results if status is "completed" */
  results?: FlightResultData[];
}

/** Flight result data returned by the agent */
export interface FlightResultData {
  airline: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  price: number;
  currency: string;
  flightUrl?: string;
}
