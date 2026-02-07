"use client";

import { useState, useTransition } from "react";

interface ServiceStatus {
  name: string;
  status: "healthy" | "unhealthy" | "unknown";
  latencyMs?: number;
  details?: string;
}

interface SystemStatusResult {
  status: string;
  timestamp: string;
  services: ServiceStatus[];
  tableCounts: Record<string, number>;
}

export function useSystemStatus() {
  const [result, setResult] = useState<SystemStatusResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    setResult(null);
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/system/status");
        const data: SystemStatusResult = await response.json();

        if (!response.ok) {
          throw new Error("Failed to fetch system status");
        }

        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    });
  }

  return { result, error, isPending, handleRefresh };
}
