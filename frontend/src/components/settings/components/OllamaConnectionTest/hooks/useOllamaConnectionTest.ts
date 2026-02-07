"use client";

import { useState, useTransition } from "react";

export function useOllamaConnectionTest() {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleTest() {
    setText("");
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/ai/ollama-test");

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Unable to connect to Ollama");
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let result = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          result += decoder.decode(value, { stream: true });
          setText(result);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    });
  }

  return { text, error, isPending, handleTest };
}
