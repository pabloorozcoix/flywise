import type { FlightSearchParams } from "@/lib/schemas/flightSearch";

/** Valid one-way economy search */
export const validOneWay: FlightSearchParams = {
  origin: "JFK",
  destination: "LHR",
  departureDate: "2026-04-10",
  cabinClass: "economy",
  directOnly: false,
};

/** Valid round-trip business search */
export const validRoundTrip: FlightSearchParams = {
  origin: "LAX",
  destination: "NRT",
  departureDate: "2026-05-01",
  returnDate: "2026-05-15",
  cabinClass: "business",
  directOnly: true,
};

/** Valid first class search with OpenAI key */
export const validWithApiKey: FlightSearchParams = {
  origin: "SFO",
  destination: "CDG",
  departureDate: "2026-06-20",
  cabinClass: "first",
  directOnly: false,
  openaiApiKey: "sk-test-1234567890abcdef",
};

/** Invalid: missing origin */
export const invalidMissingOrigin = {
  origin: "",
  destination: "LHR",
  departureDate: "2026-04-10",
  cabinClass: "economy",
  directOnly: false,
};

/** Invalid: origin too short */
export const invalidShortOrigin = {
  origin: "J",
  destination: "LHR",
  departureDate: "2026-04-10",
  cabinClass: "economy",
  directOnly: false,
};

/** Invalid: missing departure date */
export const invalidMissingDate = {
  origin: "JFK",
  destination: "LHR",
  departureDate: "",
  cabinClass: "economy",
  directOnly: false,
};

/** Invalid: bad cabin class */
export const invalidCabinClass = {
  origin: "JFK",
  destination: "LHR",
  departureDate: "2026-04-10",
  cabinClass: "premium",
  directOnly: false,
};
