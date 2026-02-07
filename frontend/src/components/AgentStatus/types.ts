import type { SearchExecutionStatus } from "@/lib/types/agentEvent";

export interface AgentStatusProps {
  /** Current execution status */
  status: SearchExecutionStatus;
  /** Error message when status is "error" */
  error?: string;
  /** Callback when user clicks retry */
  onRetry?: () => void;
  /** Callback when user clicks "View Results" */
  onViewResults?: () => void;
}
