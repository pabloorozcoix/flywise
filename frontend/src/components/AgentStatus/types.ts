import type { SearchExecutionStatus } from "@/lib/types/agentEvent";

/** Raw flight result data from the agent — accepts both snake_case (from Python) and camelCase keys */
export type AgentFlightResult = Record<string, unknown>;

export interface AgentStatusProps {
  /** Current execution status */
  status: SearchExecutionStatus;
  /** Error message when status is "error" */
  error?: string;
  /** Parsed flight results from the agent */
  results?: AgentFlightResult[];
  /** Callback when user clicks retry */
  onRetry?: () => void;
  /** Callback when user clicks "View Results" */
  onViewResults?: () => void;
}
