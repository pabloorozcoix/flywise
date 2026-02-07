"use client";

import { useState, useTransition } from "react";

interface BrowserUseHealthResult {
  status: string;
  serviceStatus?: string;
  url?: string;
  error?: string;
}

export function useBrowserUseHealthTest() {
  const [result, setResult] = useState<BrowserUseHealthResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleTest() {
    setResult(null);
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/browser-use/health");
        const data: BrowserUseHealthResult = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ?? "Unable to connect to browser-use service"
          );
        }

        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    });
  }

  return { result, error, isPending, handleTest };
}
