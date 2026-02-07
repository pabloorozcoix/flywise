import type { AgentEvent } from "@/lib/types/agentEvent";

export interface ExecutionTimelineProps {
  /** List of agent events to display */
  events: AgentEvent[];
  /** Whether to auto-scroll to latest event */
  autoScroll?: boolean;
}
