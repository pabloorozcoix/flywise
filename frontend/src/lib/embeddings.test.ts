import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateEmbedding, generateEmbeddings } from "./embeddings";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("generateEmbedding", () => {
  it("returns embedding array on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
    });

    const result = await generateEmbedding("test text");
    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/embeddings"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("test text"),
      })
    );
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(generateEmbedding("fail")).rejects.toThrow(
      "Ollama embedding request failed (500)"
    );
  });

  it("throws on invalid response body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ notEmbedding: "bad" }),
    });

    await expect(generateEmbedding("bad")).rejects.toThrow(
      "Invalid embedding response"
    );
  });

  it("uses custom model when provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [1, 2] }),
    });

    await generateEmbedding("text", "custom-model");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe("custom-model");
  });
});

describe("generateEmbeddings", () => {
  it("generates embeddings for multiple texts", async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({ embedding: [callCount, callCount * 2] }),
      };
    });

    const results = await generateEmbeddings(["a", "b", "c"]);
    expect(results).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
