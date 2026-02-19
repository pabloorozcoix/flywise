import { vi } from "vitest";

/**
 * Creates a mock pg client and pool for testing API routes.
 * Usage: vi.mock("pg", () => createMockPg(mockClient));
 */
export function createMockClient() {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
  };
  return mockClient;
}

export function createMockPool(mockClient: ReturnType<typeof createMockClient>) {
  return {
    Pool: vi.fn(() => ({
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn((...args: unknown[]) => mockClient.query(...args)),
    })),
    Client: vi.fn(() => mockClient),
    default: {
      Pool: vi.fn(() => ({
        connect: vi.fn().mockResolvedValue(mockClient),
        query: vi.fn((...args: unknown[]) => mockClient.query(...args)),
      })),
      Client: vi.fn(() => mockClient),
    },
  };
}
