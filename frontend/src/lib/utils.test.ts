import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn()", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra");
  });

  it("deduplicates Tailwind conflicts", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });

  it("handles undefined / null / empty inputs", () => {
    expect(cn(undefined, null, "", "valid")).toBe("valid");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});
