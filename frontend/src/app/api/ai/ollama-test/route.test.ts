import { describe, it, expect, vi } from "vitest";

// Mock the streamText function and localOllama before import
vi.mock("ai", () => ({
  streamText: vi.fn(),
}));

vi.mock("@/lib/localOllama", () => ({
  localOllama: vi.fn(() => "mock-model"),
  OLLAMA_MODEL: "qwen3:8b",
}));

import { GET } from "./route";
import { streamText } from "ai";

const mockedStreamText = vi.mocked(streamText);

describe("GET /api/ai/ollama-test", () => {
  it("returns a streaming text response on success", async () => {
    mockedStreamText.mockReturnValue({
      toTextStreamResponse: () => new Response("Hello from Ollama"),
    } as ReturnType<typeof streamText>);

    const response = await GET();
    const text = await response.text();

    expect(text).toBe("Hello from Ollama");
    expect(mockedStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
      })
    );
  });

  it("returns 500 error when streamText throws", async () => {
    mockedStreamText.mockImplementation(() => {
      throw new Error("Ollama not running");
    });

    const response = await GET();
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("Ollama not running");
  });

  it("returns generic message when non-Error is thrown", async () => {
    mockedStreamText.mockImplementation(() => {
      throw "unknown";
    });

    const response = await GET();
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("Unable to connect to Ollama");
  });
});
