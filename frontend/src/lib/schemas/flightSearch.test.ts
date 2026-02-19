import { describe, it, expect } from "vitest";
import {
  flightSearchParamsSchema,
  searchResponseSchema,
} from "./flightSearch";
import {
  validOneWay,
  validRoundTrip,
  validWithApiKey,
  invalidMissingOrigin,
  invalidShortOrigin,
  invalidMissingDate,
  invalidCabinClass,
} from "@/__tests__/fixtures/searchParams";

describe("flightSearchParamsSchema", () => {
  it("accepts valid one-way params", () => {
    const result = flightSearchParamsSchema.safeParse(validOneWay);
    expect(result.success).toBe(true);
  });

  it("accepts valid round-trip params", () => {
    const result = flightSearchParamsSchema.safeParse(validRoundTrip);
    expect(result.success).toBe(true);
  });

  it("accepts params with optional openaiApiKey", () => {
    const result = flightSearchParamsSchema.safeParse(validWithApiKey);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.openaiApiKey).toBe("sk-test-1234567890abcdef");
    }
  });

  it("rejects empty origin", () => {
    const result = flightSearchParamsSchema.safeParse(invalidMissingOrigin);
    expect(result.success).toBe(false);
  });

  it("rejects origin that is too short", () => {
    const result = flightSearchParamsSchema.safeParse(invalidShortOrigin);
    expect(result.success).toBe(false);
  });

  it("rejects empty departure date", () => {
    const result = flightSearchParamsSchema.safeParse(invalidMissingDate);
    expect(result.success).toBe(false);
  });

  it("rejects invalid cabin class", () => {
    const result = flightSearchParamsSchema.safeParse(invalidCabinClass);
    expect(result.success).toBe(false);
  });

  it("allows returnDate to be omitted", () => {
    const { returnDate, ...noReturn } = validOneWay;
    const result = flightSearchParamsSchema.safeParse(noReturn);
    expect(result.success).toBe(true);
  });
});

describe("searchResponseSchema", () => {
  it("parses valid response", () => {
    const result = searchResponseSchema.safeParse({
      searchId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      status: "running",
    });
    expect(result.success).toBe(true);
  });

  it("accepts completed with optional error", () => {
    const result = searchResponseSchema.safeParse({
      searchId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      status: "failed",
      error: "Something went wrong",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    const result = searchResponseSchema.safeParse({
      searchId: "not-a-uuid",
      status: "running",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = searchResponseSchema.safeParse({
      searchId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      status: "pending",
    });
    expect(result.success).toBe(false);
  });
});
