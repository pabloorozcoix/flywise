/**
 * TypeScript types for flight search results.
 */

/** A single flight result extracted by the browser-use agent */
export interface FlightResult {
  /** Unique result identifier */
  id: string;
  /** Search ID this result belongs to */
  searchId: string;
  /** Airline name (e.g., "British Airways") */
  airline: string;
  /** Departure time (ISO string) */
  departure: string;
  /** Arrival time (ISO string) */
  arrival: string;
  /** Flight duration (e.g., "7h 30m") */
  duration: string;
  /** Number of stops (0 = non-stop) */
  stops: number;
  /** Price amount */
  price: number;
  /** Currency code (e.g., "USD") */
  currency: string;
  /** URL to book the flight */
  url?: string;
  /** Origin airport code */
  origin?: string;
  /** Destination airport code */
  destination?: string;
  /** Cabin class */
  cabinClass?: string;
  /** Whether this result has been verified against the source */
  verified?: boolean;
  /** When the result was last verified (ISO string) */
  verifiedAt?: string;
}

/** Sort options for flight results */
export type FlightSortField = "price" | "duration" | "departure";

/** Sort direction */
export type SortDirection = "asc" | "desc";

/** Filter options for flight results */
export interface FlightFilters {
  directOnly: boolean;
}
