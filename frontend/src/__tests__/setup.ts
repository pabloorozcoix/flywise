import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// ──────────────────────────────────────────────
// Cleanup after each test
// ──────────────────────────────────────────────
afterEach(() => {
  cleanup();
});

// ──────────────────────────────────────────────
// Mock next/navigation
// ──────────────────────────────────────────────
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockBack = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    refresh: mockRefresh,
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

// ──────────────────────────────────────────────
// Mock next-themes
// ──────────────────────────────────────────────
vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "dark",
    setTheme: vi.fn(),
    resolvedTheme: "dark",
    themes: ["light", "dark"],
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ──────────────────────────────────────────────
// Mock next/font/google
// ──────────────────────────────────────────────
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter" }),
  JetBrains_Mono: () => ({ variable: "--font-jetbrains-mono" }),
}));

// ──────────────────────────────────────────────
// Mock scrollIntoView (not available in jsdom)
// ──────────────────────────────────────────────
Element.prototype.scrollIntoView = vi.fn();

// ──────────────────────────────────────────────
// Mock navigator.clipboard
// ──────────────────────────────────────────────
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(""),
  },
  writable: true,
  configurable: true,
});

// ──────────────────────────────────────────────
// Mock window.matchMedia (needed by Radix UI)
// ──────────────────────────────────────────────
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ──────────────────────────────────────────────
// Mock ResizeObserver (needed by Radix UI)
// ──────────────────────────────────────────────
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ──────────────────────────────────────────────
// Export helpers for per-test overrides
// ──────────────────────────────────────────────
export { mockPush, mockReplace, mockBack, mockRefresh };
