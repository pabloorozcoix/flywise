import { z } from "zod";

/**
 * Zod schema for flight search parameters.
 * Used for form validation and API request validation.
 */
export const flightSearchParamsSchema = z.object({
  origin: z
    .string()
    .min(2, "Origin must be at least 2 characters")
    .max(10, "Origin must be at most 10 characters")
    .describe("Origin airport code (e.g., JFK)"),
  destination: z
    .string()
    .min(2, "Destination must be at least 2 characters")
    .max(10, "Destination must be at most 10 characters")
    .describe("Destination airport code (e.g., LHR)"),
  departureDate: z
    .string()
    .min(1, "Departure date is required")
    .describe("Departure date (YYYY-MM-DD)"),
  returnDate: z
    .string()
    .optional()
    .describe("Return date (YYYY-MM-DD, optional for one-way)"),
  cabinClass: z
    .enum(["economy", "business", "first"])
    .describe("Cabin class"),
  directOnly: z
    .boolean()
    .describe("Only show direct/non-stop flights"),
});

export type FlightSearchParams = z.infer<typeof flightSearchParamsSchema>;

/**
 * Schema for search API response.
 */
export const searchResponseSchema = z.object({
  searchId: z.string().uuid(),
  status: z.enum(["running", "completed", "failed"]),
  error: z.string().optional(),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;
