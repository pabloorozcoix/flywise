import { describe, it, expect, vi } from "vitest";

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => vi.fn()),
}));

describe("localOllama", () => {
  it("exports localOllama provider and OLLAMA_MODEL", async () => {
    const mod = await import("./localOllama");
    expect(mod.localOllama).toBeDefined();
    expect(mod.OLLAMA_MODEL).toBe("qwen3:8b");
  });

  it("calls createOpenAICompatible with correct config", async () => {
    const { createOpenAICompatible } = await import(
      "@ai-sdk/openai-compatible"
    );
    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "ollama",
        apiKey: "not-required",
      })
    );
  });

  it("uses OLLAMA_HOST env var when set", async () => {
    vi.resetModules();
    process.env.OLLAMA_HOST = "http://custom-host:11434";
    vi.mock("@ai-sdk/openai-compatible", () => ({
      createOpenAICompatible: vi.fn(() => vi.fn()),
    }));
    await import("./localOllama");
    const { createOpenAICompatible } = await import(
      "@ai-sdk/openai-compatible"
    );
    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "http://custom-host:11434/v1",
      })
    );
    delete process.env.OLLAMA_HOST;
  });
});
