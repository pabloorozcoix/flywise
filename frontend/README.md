# AeroAgent AI — Frontend

A [Next.js 16](https://nextjs.org) application bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app). This is the user-facing interface and API gateway for AeroAgent AI.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
  - [Quick Start](#quick-start-1)
  - [Test Infrastructure](#test-infrastructure)
  - [Test File Organization](#test-file-organization)
  - [Global Test Setup](#global-test-setup)
  - [Fixtures & Test Data](#fixtures--test-data)
  - [Mocking Strategy](#mocking-strategy)
  - [Writing New Tests](#writing-new-tests)
  - [Coverage](#coverage)
  - [Coverage Exclusions](#coverage-exclusions)
- [Project Structure](#project-structure)
- [Learn More](#learn-more)

---

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `next dev` | Start development server with HMR |
| `npm run build` | `next build` | Create production build |
| `npm run start` | `next start` | Start production server |
| `npm run lint` | `eslint` | Run ESLint |
| `npm test` | `vitest run` | Run all tests once |
| `npm run test:watch` | `vitest` | Run tests in watch mode (re-runs on file changes) |
| `npm run test:coverage` | `vitest run --coverage` | Run tests with V8 coverage report |

---

## Testing

The frontend has **100% test coverage** (statements, branches, functions, lines) using a combination of unit and integration tests.

### Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on save)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npx vitest run src/components/FlightCard/FlightCard.test.tsx

# Run tests matching a pattern
npx vitest run --reporter=verbose src/app/api/
```

### Test Infrastructure

| Tool | Version | Purpose |
|------|---------|---------|
| [Vitest](https://vitest.dev) | ^3.2 | Test runner and framework (Vite-native, ESM-first) |
| [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) | ^16.3 | DOM testing utilities for React components |
| [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) | ^6.9 | Custom matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.) |
| [@testing-library/user-event](https://testing-library.com/docs/user-event/intro/) | ^14.6 | Simulates real user interactions (click, type, keyboard) |
| [jsdom](https://github.com/jsdom/jsdom) | ^26.1 | Browser-like DOM environment for Node.js |
| [@vitest/coverage-v8](https://vitest.dev/guide/coverage) | ^3.2 | V8-based code coverage provider |
| [MSW](https://mswjs.io) | ^2.12 | Mock Service Worker for API mocking (unused in current tests but available) |

**Configuration file:** [`vitest.config.ts`](vitest.config.ts)

```typescript
// Key configuration highlights:
// - Environment: jsdom (browser-like DOM)
// - Path alias: @ → src/ (matches Next.js tsconfig)
// - Setup file: src/__tests__/setup.ts (runs before every test)
// - Coverage provider: V8 (fastest, native to Node.js)
```

### Test File Organization

Tests are **colocated** next to the source files they test, following the `*.test.{ts,tsx}` naming convention:

```
src/
├── __tests__/                          # Shared test infrastructure
│   ├── setup.ts                        #   Global mocks & environment setup
│   ├── fixtures/                       #   Reusable test data
│   │   ├── agentEvents.ts              #     Agent execution event fixtures
│   │   ├── apiResponses.ts             #     API response fixtures
│   │   ├── flightResults.ts            #     Flight result fixtures
│   │   └── searchParams.ts             #     Search parameter fixtures
│   └── helpers/
│       └── mockPg.ts                   #   Shared PostgreSQL mock (vi.hoisted)
│
├── app/
│   ├── layout.test.tsx                 # RootLayout unit test
│   ├── page.test.tsx                   # Home page integration test
│   ├── results/[id]/page.test.tsx      # Results page integration test
│   ├── history/[id]/page.test.tsx      # History page integration test
│   ├── settings/page.test.tsx          # Settings page integration test
│   └── api/
│       ├── health/route.test.ts        # Health endpoint unit test
│       ├── search/route.test.ts        # Search initiation unit test
│       ├── search/[id]/cancel/route.test.ts
│       ├── results/[id]/route.test.ts
│       ├── status/[id]/route.test.ts
│       ├── verify/[id]/route.test.ts
│       ├── callback/search-complete/route.test.ts
│       ├── memory/route.test.ts
│       ├── memory/search/route.test.ts
│       ├── db/test-connection/route.test.ts
│       ├── db/test-pgvector/route.test.ts
│       ├── ai/ollama-test/route.test.ts
│       ├── browser-use/health/route.test.ts
│       └── system/status/route.test.ts
│
├── components/
│   ├── AgentStatus/AgentStatus.test.tsx
│   ├── ExecutionTimeline/
│   │   ├── ExecutionTimeline.test.tsx
│   │   └── hooks/useSearchExecution.test.ts
│   ├── FlightCard/FlightCard.test.tsx
│   ├── Footer/Footer.test.tsx
│   ├── Navbar/Navbar.test.tsx
│   ├── SearchForm/
│   │   ├── SearchForm.test.tsx
│   │   └── hooks/useFlightSearch.test.ts
│   ├── settings/
│   │   ├── settings.test.tsx
│   │   └── components/
│   │       ├── BrowserUseHealthTest/
│   │       │   ├── BrowserUseHealthTest.test.tsx
│   │       │   └── hooks/useBrowserUseHealthTest.test.ts
│   │       ├── DatabaseConnectionTest/
│   │       │   ├── DatabaseConnectionTest.test.tsx
│   │       │   └── hooks/useDatabaseConnectionTest.test.ts
│   │       ├── OllamaConnectionTest/
│   │       │   ├── OllamaConnectionTest.test.tsx
│   │       │   └── hooks/useOllamaConnectionTest.test.ts
│   │       └── SystemStatus/
│   │           ├── SystemStatus.test.tsx
│   │           └── hooks/useSystemStatus.test.ts
│   ├── theme-provider.test.tsx
│   ├── theme-toggle.test.tsx
│   └── ui/
│       ├── badge.test.tsx
│       ├── button.test.tsx
│       ├── calendar.test.tsx
│       ├── card.test.tsx
│       ├── form.test.tsx
│       ├── input.test.tsx
│       ├── label.test.tsx
│       ├── popover.test.tsx
│       ├── select.test.tsx
│       ├── switch.test.tsx
│       └── tabs.test.tsx
│
├── db/schema.test.ts
└── lib/
    ├── utils.test.ts
    ├── embeddings.test.ts
    ├── localOllama.test.ts
    ├── supabase.test.ts
    └── schemas/flightSearch.test.ts
```

**55 test files** covering **150+ test cases**.

### Global Test Setup

The file [`src/__tests__/setup.ts`](src/__tests__/setup.ts) runs before every test and provides:

| Mock / Polyfill | What It Does |
|-----------------|-------------|
| `@testing-library/jest-dom/vitest` | Adds custom DOM matchers to Vitest's `expect` |
| `next/navigation` | Mocks `useRouter`, `usePathname`, `useParams`, `useSearchParams` |
| `next-themes` | Mocks `useTheme` and `ThemeProvider` |
| `next/font/google` | Mocks `Inter` and `JetBrains_Mono` font loaders |
| `Element.scrollIntoView` | Polyfills `scrollIntoView` (missing in jsdom) |
| `navigator.clipboard` | Mocks clipboard API (`writeText`, `readText`) |
| `window.matchMedia` | Polyfills `matchMedia` (required by Radix UI) |
| `ResizeObserver` | Polyfills `ResizeObserver` (required by Radix UI) |

**Per-test overrides:** The setup exports `mockPush`, `mockReplace`, `mockBack`, and `mockRefresh` so individual tests can assert on navigation calls:

```typescript
import { mockPush } from "@/__tests__/setup";

it("navigates to results", async () => {
  // ... trigger navigation ...
  expect(mockPush).toHaveBeenCalledWith("/results/abc-123");
});
```

### Fixtures & Test Data

Shared test data lives in `src/__tests__/fixtures/` to ensure consistency across tests:

| Fixture File | Exports | Used By |
|-------------|---------|---------|
| `flightResults.ts` | `mockFlightResult`, `mockFlightResults` | `FlightCard`, Results page, API route tests |
| `agentEvents.ts` | `mockAgentEvent`, `progressEvents`, `progressWithMemoryEvents`, `progressWithIntermediateStatusEvents`, `progressWithUndefinedStep` | `ExecutionTimeline`, History page tests |
| `searchParams.ts` | `mockSearchParams`, `validSearchBody` | `SearchForm`, API search route tests |
| `apiResponses.ts` | `mockResultsApiResponse`, `mockStatusApiResponse` | Page-level integration tests, hook tests |

**Example — using a fixture in a test:**

```typescript
import { mockFlightResult } from "@/__tests__/fixtures/flightResults";

it("renders flight card", () => {
  render(<FlightCard flight={mockFlightResult} />);
  expect(screen.getByText(/Delta/)).toBeInTheDocument();
});
```

### Mocking Strategy

#### Next.js Runtime Mocks (Global)

Next.js APIs like `useRouter`, `cookies()`, and `NextResponse` don't work outside a Next.js server. These are mocked globally in `setup.ts`.

#### PostgreSQL / Database Mocks (`vi.hoisted`)

API routes that query PostgreSQL use `pg.Pool`. These are mocked using `vi.hoisted()` to handle Vitest's module hoisting:

```typescript
// src/__tests__/helpers/mockPg.ts — shared mock
const mocks = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockRelease: vi.fn(),
  mockEnd: vi.fn(),
  // ...
}));

vi.mock("pg", () => ({
  default: { Pool: vi.fn(() => ({ connect: vi.fn(() => ({ query: mocks.mockQuery, release: mocks.mockRelease })) })) },
  Pool: vi.fn(() => ({ connect: vi.fn(() => ({ query: mocks.mockQuery, release: mocks.mockRelease })) })),
}));
```

**Why `vi.hoisted()`?** Vitest hoists `vi.mock()` calls to the top of the file. If mock variables are defined with `const` below the `vi.mock()` call, they'll be `undefined` when the factory runs. `vi.hoisted()` ensures the variables are initialized before hoisting occurs.

#### External Service Mocks (Per-Test)

Mocks for `fetch`, `globalThis.fetch`, Ollama, and Supabase are set up per-test or per-file using `vi.mock()` and `vi.spyOn()`:

```typescript
// Mock fetch for a specific test
vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
  new Response(JSON.stringify({ status: "ok" }), { status: 200 })
);
```

#### Component Mocks (Per-Test)

Complex child components are occasionally mocked to isolate the component under test:

```typescript
vi.mock("@/components/SearchForm", () => ({
  SearchForm: () => <div data-testid="mock-search-form" />,
}));
```

### Writing New Tests

#### Unit Test for a Utility Function

```typescript
// src/lib/myUtil.test.ts
import { describe, it, expect } from "vitest";
import { myUtil } from "./myUtil";

describe("myUtil", () => {
  it("returns expected result", () => {
    expect(myUtil("input")).toBe("output");
  });
});
```

#### Unit Test for a React Component

```typescript
// src/components/MyComponent/MyComponent.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyComponent } from "./MyComponent";

describe("MyComponent", () => {
  it("renders content", () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("handles click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MyComponent onClick={onClick} />);

    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

#### Unit Test for an API Route

```typescript
// src/app/api/my-route/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// 1. Use vi.hoisted() for any mocks referenced in vi.mock() factories
const mocks = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockRelease: vi.fn(),
}));

// 2. Mock external dependencies
vi.mock("pg", () => ({
  default: {
    Pool: vi.fn(() => ({
      connect: vi.fn(() => Promise.resolve({
        query: mocks.mockQuery,
        release: mocks.mockRelease,
      })),
    })),
  },
}));

// 3. Import the route handler AFTER mocks are set up
import { GET } from "./route";

describe("GET /api/my-route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with data", async () => {
    mocks.mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ data: [{ id: 1 }] });
  });
});
```

#### Unit Test for a Custom Hook

```typescript
// src/components/MyComponent/hooks/useMyHook.test.ts
import { renderHook, act, waitFor } from "@testing-library/react";
import { useMyHook } from "./useMyHook";

describe("useMyHook", () => {
  it("updates state on action", async () => {
    const { result } = renderHook(() => useMyHook());

    await act(async () => {
      result.current.doSomething();
    });

    await waitFor(() => {
      expect(result.current.data).toBe("expected");
    });
  });
});
```

### Coverage

Run the full coverage report:

```bash
npm run test:coverage
```

This generates a detailed report in the terminal showing per-file coverage for:

- **Statements** — individual executable statements
- **Branches** — conditional paths (`if/else`, `?:`, `??`, `||`)
- **Functions** — function/method declarations
- **Lines** — physical source lines

Current coverage: **100%** across all four metrics.

### Coverage Exclusions

Some code is intentionally excluded from coverage tracking:

#### In `vitest.config.ts`

| Excluded Pattern | Reason |
|-----------------|--------|
| `src/**/*.test.{ts,tsx}` | Test files themselves |
| `src/__tests__/**` | Test infrastructure (setup, fixtures, helpers) |
| `src/**/types.ts`, `src/**/types/**` | Pure TypeScript type definitions (no runtime code) |
| `src/**/index.ts` | Barrel re-export files (no logic) |
| `src/app/globals.css` | CSS file |
| `src/db/schema.ts` | Drizzle ORM schema — `customType()` creates internal wrapper functions that inflate function count artificially |

#### In Source Files (`c8 ignore` / `istanbul ignore`)

Defensive code paths that are unreachable or untestable in jsdom are annotated with `// c8 ignore next` comments:

| Pattern | Example | Reason |
|---------|---------|--------|
| `catch` after `new Date()` | `FlightCard.tsx` | `new Date()` never throws in JavaScript |
| `instanceof Error` ternary | API routes | Non-Error throws are extremely rare; tested via separate test cases where feasible |
| `date ?? ""` in `onSelect` | `SearchForm.tsx` | Calendar `onSelect` deselection callback — defensive guard |
| Inline `\|\|` / `??` fallbacks | `useSearchExecution.ts`, API routes | Defensive defaults for data from external services |
| Sort comparator branches | `results/[id]/page.tsx` | Radix UI Select can't be fully interacted with in jsdom |
| WebSocket state guards | `useSearchExecution.ts` | Race condition guards that prevent impossible state transitions |

---

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              #   Root layout (ThemeProvider, Navbar, Footer)
│   ├── page.tsx                #   Home page (SearchForm)
│   ├── results/[id]/page.tsx   #   Flight results (sort, filter)
│   ├── history/[id]/page.tsx   #   Live execution timeline (WebSocket)
│   ├── settings/page.tsx       #   Service health dashboard
│   └── api/                    #   14 REST API routes
├── components/                 #   React components (directory-per-component)
│   ├── ui/                     #     11 shadcn/ui primitives
│   ├── SearchForm/             #     Flight search form + useFlightSearch hook
│   ├── FlightCard/             #     Flight result card
│   ├── ExecutionTimeline/      #     Agent progress + useSearchExecution hook
│   ├── AgentStatus/            #     Status badge
│   ├── Navbar/                 #     App navigation
│   ├── Footer/                 #     App footer
│   └── settings/               #     Health test components
├── db/
│   └── schema.ts               #   Drizzle ORM schema (pgvector custom type)
├── lib/
│   ├── localOllama.ts          #   AI SDK OpenAI-compatible provider for Ollama
│   ├── supabase.ts             #   Supabase client + DATABASE_URL export
│   ├── embeddings.ts           #   Ollama-powered vector embedding generation
│   ├── utils.ts                #   cn() class merge utility
│   └── schemas/
│       └── flightSearch.ts     #   Zod validation schemas
└── __tests__/                  #   Shared test infrastructure
    ├── setup.ts                #     Global mocks & polyfills
    ├── fixtures/               #     Reusable test data
    └── helpers/                #     Shared mock utilities
```

---

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) — learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) — an interactive Next.js tutorial.

For testing:

- [Vitest Documentation](https://vitest.dev) — test runner configuration and API.
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) — component testing best practices.
- [Testing Library Queries](https://testing-library.com/docs/queries/about) — how to query the DOM in tests.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) — your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
