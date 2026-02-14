import type { FlightResult } from "@/lib/types/flightResult";

export interface FlightCardProps {
  /** The flight result data to render */
  flight: FlightResult;
  /** Optional rank (1 = best value, 2 = cheapest) for badge display */
  rank?: number;
}
