/**
 * Canned API response payloads for mocking fetch/MSW handlers.
 */

/** POST /api/search — success (new search) */
export const searchCreated = {
  searchId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  status: "running",
};

/** POST /api/search — cache hit */
export const searchCached = {
  searchId: "11111111-2222-3333-4444-555555555555",
  status: "completed",
  cached: true,
};

/** GET /api/results/[id] — with results */
export const resultsSuccess = {
  searchId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  status: "completed",
  searchParams: {
    origin: "JFK",
    destination: "LHR",
    departureDate: "2026-04-10",
    returnDate: null,
    cabinClass: "economy",
    directOnly: false,
  },
  llm: {
    provider: "ollama",
    model: "qwen3:8b",
  },
  results: [
    {
      id: "r1",
      searchId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      airline: "British Airways",
      departure: "2026-04-10T08:00:00Z",
      arrival: "2026-04-10T20:30:00Z",
      duration: "7h 30m",
      stops: 0,
      price: 450,
      currency: "USD",
      url: "https://ba.com/book",
      origin: "JFK",
      destination: "LHR",
      cabinClass: "economy",
    },
    {
      id: "r2",
      searchId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      airline: "Delta",
      departure: "2026-04-10T14:00:00Z",
      arrival: "2026-04-11T02:15:00Z",
      duration: "9h 15m",
      stops: 1,
      price: 380,
      currency: "USD",
      url: "https://delta.com/book",
      origin: "JFK",
      destination: "LHR",
      cabinClass: "economy",
    },
  ],
};

/** GET /api/results/[id] — not found */
export const resultsNotFound = {
  error: "Search not found",
};

/** GET /api/status/[id] — running */
export const statusRunning = {
  searchId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  status: "running",
  results: [],
};

/** GET /api/status/[id] — completed */
export const statusCompleted = {
  searchId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  status: "completed",
  results: resultsSuccess.results,
};

/** GET /api/health */
export const healthOk = {
  status: "ok",
  timestamp: "2026-03-15T12:00:00Z",
};

/** GET /api/system/status — all healthy */
export const systemHealthy = {
  status: "healthy",
  timestamp: "2026-03-15T12:00:00Z",
  services: [
    { name: "Ollama", status: "healthy", latencyMs: 42 },
    { name: "Browser-Use", status: "healthy", latencyMs: 15 },
    { name: "PostgreSQL", status: "healthy", latencyMs: 3 },
  ],
  tableCounts: {
    agent_ctx: 12,
    agent_state: 12,
    flight_results: 48,
    memory: 36,
  },
};

/** GET /api/system/status — degraded */
export const systemDegraded = {
  status: "degraded",
  timestamp: "2026-03-15T12:00:00Z",
  services: [
    { name: "Ollama", status: "healthy", latencyMs: 42 },
    { name: "Browser-Use", status: "unhealthy", details: "Connection refused" },
    { name: "PostgreSQL", status: "healthy", latencyMs: 3 },
  ],
  tableCounts: {
    agent_ctx: 5,
    agent_state: 5,
    flight_results: 0,
    memory: 10,
  },
};

/** POST /api/callback/search-complete body */
export const callbackCompleted = {
  search_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  status: "completed",
  results: [
    {
      airline: "British Airways",
      departure_time: "2026-04-10T08:00:00Z",
      arrival_time: "2026-04-10T20:30:00Z",
      duration: "7h 30m",
      stops: 0,
      price: 450,
      currency: "USD",
      flight_url: "https://ba.com/book",
    },
  ],
};

/** POST /api/callback/search-complete body — failure */
export const callbackFailed = {
  search_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  status: "failed",
  error: "Agent timeout after 120s",
};

/** GET /api/browser-use/health — healthy */
export const browserUseHealthy = {
  status: "ok",
  serviceStatus: "healthy",
  url: "http://browser-use:8000",
};

/** GET /api/db/test-connection — success */
export const dbConnected = {
  status: "connected",
  version: "PostgreSQL 16.1",
};

/** GET /api/db/test-pgvector — success */
export const pgvectorActive = {
  status: "pgvector_active",
  pgvectorVersion: "0.7.0",
  test: {
    nearestId: 1,
    nearestEmbedding: "[1,2,3]",
    distance: 0,
  },
};

/** POST /api/memory — success */
export const memoryStored = {
  id: "mem-001",
  hasEmbedding: true,
};

/** GET /api/memory/search — results */
export const memorySearchResults = {
  query: "JFK to London",
  count: 2,
  memories: [
    {
      id: "mem-1",
      agentCtxId: "ctx-1",
      content: "Flight search JFK → LHR found 5 results",
      stepNumber: 1,
      similarity: 0.92,
      createdAt: "2026-03-14T10:00:00Z",
      searchContext: { origin: "JFK", destination: "LHR", departureDate: "2026-03-15" },
    },
    {
      id: "mem-2",
      agentCtxId: "ctx-2",
      content: "Flight search JFK → LGW found 3 results",
      stepNumber: 1,
      similarity: 0.85,
      createdAt: "2026-03-13T10:00:00Z",
    },
  ],
};

/** POST /api/verify/[id] — success */
export const verifySuccess = {
  id: "fr-1",
  verified: true,
  verifiedAt: "2026-03-15T12:00:00Z",
  message: "Stub: result marked as verified. Multi-source verification not yet implemented.",
};
