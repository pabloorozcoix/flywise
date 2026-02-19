import { describe, it, expect, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe("supabase module", () => {
  it("exports supabase client", async () => {
    const mod = await import("./supabase");
    expect(mod.supabase).toBeDefined();
  });

  it("exports DATABASE_URL", async () => {
    const mod = await import("./supabase");
    expect(mod.DATABASE_URL).toBeDefined();
    expect(typeof mod.DATABASE_URL).toBe("string");
  });
});
