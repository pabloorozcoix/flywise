import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns status ok with timestamp", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
    expect(() => new Date(data.timestamp)).not.toThrow();
  });

  it("returns 200", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });
});
