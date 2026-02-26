import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/results",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

import { redirect } from "next/navigation";
import ResultsRedirectPage from "./page";

const mockRedirect = vi.mocked(redirect);

describe("ResultsRedirectPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /history when no query params", async () => {
    await ResultsRedirectPage({ searchParams: Promise.resolve({}) });
    expect(mockRedirect).toHaveBeenCalledWith("/history");
  });

  it("preserves query params in redirect", async () => {
    await ResultsRedirectPage({
      searchParams: Promise.resolve({ q: "test", page: "2" }),
    });
    expect(mockRedirect).toHaveBeenCalledWith("/history?q=test&page=2");
  });

  it("handles array values in search params", async () => {
    await ResultsRedirectPage({
      searchParams: Promise.resolve({ tags: ["a", "b"] }),
    });
    expect(mockRedirect).toHaveBeenCalledWith("/history?tags=a&tags=b");
  });

  it("handles undefined values in search params", async () => {
    await ResultsRedirectPage({
      searchParams: Promise.resolve({ key: undefined } as Record<string, string | string[] | undefined>),
    });
    expect(mockRedirect).toHaveBeenCalledWith("/history?key=undefined");
  });

  it("redirects to /history when params is null-like", async () => {
    // Force the else branch of the typeof/null/array guard
    await ResultsRedirectPage({
      searchParams: Promise.resolve(null as unknown as Record<string, string | string[] | undefined>),
    });
    expect(mockRedirect).toHaveBeenCalledWith("/history");
  });

  it("redirects to /history when params is an array", async () => {
    await ResultsRedirectPage({
      searchParams: Promise.resolve([] as unknown as Record<string, string | string[] | undefined>),
    });
    expect(mockRedirect).toHaveBeenCalledWith("/history");
  });
});
