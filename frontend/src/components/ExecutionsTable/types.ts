import type { ExecutionRow } from "@/lib/types/execution";

export interface ExecutionsTableProps {
  data: ExecutionRow[];
  loading?: boolean;
  onDelete?: (searchId: string) => Promise<void>;
}
