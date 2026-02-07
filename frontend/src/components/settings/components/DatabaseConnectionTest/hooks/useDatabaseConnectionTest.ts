"use client";

import { useState, useTransition } from "react";

interface ConnectionResult {
  status: string;
  version?: string;
  error?: string;
}

interface PgvectorResult {
  status: string;
  pgvectorVersion?: string;
  test?: {
    nearestId: number;
    nearestEmbedding: string;
    distance: number;
  };
  error?: string;
}

export function useDatabaseConnectionTest() {
  const [connectionResult, setConnectionResult] =
    useState<ConnectionResult | null>(null);
  const [pgvectorResult, setPgvectorResult] =
    useState<PgvectorResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleTestConnection() {
    setConnectionResult(null);
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/db/test-connection");
        const data: ConnectionResult = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to connect to database");
        }

        setConnectionResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    });
  }

  function handleTestPgvector() {
    setPgvectorResult(null);
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/db/test-pgvector");
        const data: PgvectorResult = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to test pgvector");
        }

        setPgvectorResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    });
  }

  return {
    connectionResult,
    pgvectorResult,
    error,
    isPending,
    handleTestConnection,
    handleTestPgvector,
  };
}
