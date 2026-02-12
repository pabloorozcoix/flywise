"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FlightSearchParams } from "@/lib/schemas/flightSearch";

/**
 * Hook that handles flight search form submission.
 * Posts to /api/search and redirects to the execution page.
 */
export function useFlightSearch() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitSearch = async (params: FlightSearchParams) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Search failed (${response.status})`);
      }

      const data = await response.json();
      router.push(`/history/${data.searchId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      setIsSubmitting(false);
    }
  };

  return { submitSearch, isSubmitting, error };
}
