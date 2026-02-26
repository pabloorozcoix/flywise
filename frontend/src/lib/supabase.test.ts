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

  it("uses default DATABASE_URL when env var is not set", async () => {
    vi.resetModules();
    const savedUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    vi.mock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => ({ from: vi.fn() })),
    }));
    const mod = await import("./supabase");
    expect(mod.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@supabase-db:5432/postgres"
    );
    if (savedUrl !== undefined) process.env.DATABASE_URL = savedUrl;
  });
});
