import type { FlightResult } from "@/lib/types/flightResult";

let counter = 0;

export function mockFlightResult(
  overrides: Partial<FlightResult> = {}
): FlightResult {
  counter++;
  return {
    id: `fr-${counter}`,
    searchId: "search-001",
    airline: "Test Airways",
    departure: "2026-03-15T08:00:00Z",
    arrival: "2026-03-15T16:30:00Z",
    duration: "7h 30m",
    stops: 0,
    price: 450,
    currency: "USD",
    url: "https://example.com/book",
    origin: "JFK",
    destination: "LHR",
    cabinClass: "economy",
    verified: false,
    ...overrides,
  };
}

/** Empty results array */
export const emptyResults: FlightResult[] = [];

/** Single non-stop flight */
export const singleResult: FlightResult[] = [mockFlightResult()];

/** Multiple flights with variety */
export const multipleResults: FlightResult[] = [
  mockFlightResult({
    id: "fr-best",
    airline: "BestAir",
    price: 320,
    stops: 1,
    duration: "9h 15m",
    verified: true,
    verifiedAt: "2026-03-15T20:00:00Z",
  }),
  mockFlightResult({
    id: "fr-cheap",
    airline: "BudgetJet",
    price: 280,
    stops: 2,
    duration: "14h 45m",
    currency: "USD",
  }),
  mockFlightResult({
    id: "fr-direct",
    airline: "DirectAir",
    price: 650,
    stops: 0,
    duration: "7h 0m",
    verified: true,
  }),
  mockFlightResult({
    id: "fr-nourl",
    airline: "NoLink Airlines",
    price: 500,
    stops: 1,
    duration: "10h 20m",
    url: undefined,
  }),
];

/** Flight with EUR currency */
export const eurFlight = mockFlightResult({
  id: "fr-eur",
  price: 390,
  currency: "EUR",
  airline: "EuroWings",
});
