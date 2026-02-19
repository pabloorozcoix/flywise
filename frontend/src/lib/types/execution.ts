/**
 * Types for search execution list (agent_ctx + agent_state + result count).
 */

export interface ExecutionRow {
  searchId: string;
  origin: string;
  destination: string;
  departureDate: string | null;
  returnDate: string | null;
  cabinClass: string | null;
  directOnly: boolean;
  createdAt: string | null;
  status: string;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  resultCount: number;
}

export interface ExecutionsApiResponse {
  executions: ExecutionRow[];
}
