import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const localOllama = createOpenAICompatible({
  name: "ollama",
  baseURL: process.env.OLLAMA_HOST
    ? `${process.env.OLLAMA_HOST}/v1`
    : "http://ollama:11434/v1",
  apiKey: "not-required",
});

export const OLLAMA_MODEL = "qwen3:8b";
