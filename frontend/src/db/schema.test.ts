import { describe, it, expect } from "vitest";
import { agentCtx, agentState, memory, flightResults } from "./schema";

describe("DB schema tables", () => {
  it("exports agentCtx table", () => {
    expect(agentCtx).toBeDefined();
  });

  it("exports agentState table", () => {
    expect(agentState).toBeDefined();
  });

  it("exports memory table", () => {
    expect(memory).toBeDefined();
  });

  it("exports flightResults table", () => {
    expect(flightResults).toBeDefined();
  });

  describe("vector1536 custom type", () => {
    // Access the embedding column's internal driver-mapping methods
    const embeddingCol = memory.embedding as unknown as {
      mapToDriverValue: (value: number[]) => string;
      mapFromDriverValue: (value: string) => number[];
    };

    it("toDriver serializes a number array to bracket-delimited string", () => {
      const result = embeddingCol.mapToDriverValue([1.5, 2.0, 3.25]);
      expect(result).toBe("[1.5,2,3.25]");
    });

    it("fromDriver deserializes a bracket-delimited string to number array", () => {
      const result = embeddingCol.mapFromDriverValue("[1.5, 2.0, 3.25]");
      expect(result).toEqual([1.5, 2, 3.25]);
    });

    it("fromDriver handles empty brackets", () => {
      const result = embeddingCol.mapFromDriverValue("[]");
      expect(result).toEqual([]);
    });

    it("dataType returns correct SQL type", () => {
      // Access the column's dataType method
      const col = memory.embedding as unknown as { getSQLType: () => string };
      const sqlType = col.getSQLType();
      expect(sqlType).toBe("vector(1536)");
    });
  });
});
