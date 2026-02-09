"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plane,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Loader2,
} from "lucide-react";

import { ExecutionTimeline } from "@/components/ExecutionTimeline";
import { AgentStatus } from "@/components/AgentStatus";
import { useSearchExecution } from "@/components/ExecutionTimeline/hooks/useSearchExecution";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

interface SearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  cabinClass: string;
  directOnly: boolean;
}

export default function SearchExecutionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchId = params.id;

  const { status, events, error, results, retry } = useSearchExecution(searchId);

  // Once search completes, poll DB until persisted results are available.
  // The callback saves results to DB asynchronously, so we retry until they appear.
  const [dbData, setDbData] = useState<{
    searchParams: SearchParams;
    flights: Record<string, unknown>[];
  } | null>(null);

  useEffect(() => {
    if (status !== "completed") return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15; // 30s max

    const poll = async () => {
      try {
        const res = await fetch(`/api/results/${searchId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.searchParams && data.results?.length > 0) {
          if (!cancelled) {
            setDbData({
              searchParams: data.searchParams,
              flights: data.results as Record<string, unknown>[],
            });
          }
          return; // stop polling
        }
      } catch {
        // ignore, will retry
      }

      attempts++;
      if (attempts < maxAttempts && !cancelled) {
        setTimeout(poll, 2000);
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [status, searchId]);

  // JSON panel state
  const [jsonExpanded, setJsonExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const isCompleted = status === "completed";

  // Build the full output object exclusively from DB-persisted data
  const fullOutput = dbData
    ? {
        search: {
          origin: dbData.searchParams.origin,
          destination: dbData.searchParams.destination,
          departure_date: dbData.searchParams.departureDate,
          return_date: dbData.searchParams.returnDate ?? null,
          cabin_class: dbData.searchParams.cabinClass,
          direct_only: dbData.searchParams.directOnly,
        },
        flights: dbData.flights,
      }
    : null;

  // For the status badge, use WS results count or DB count
  const flightCount =
    dbData?.flights.length ??
    ((results ?? []) as unknown[]).length;

  const handleCopy = () => {
    if (fullOutput) {
      navigator.clipboard.writeText(JSON.stringify(fullOutput, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-8 font-sans dark:bg-black">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Plane className="size-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              Flight Search
            </h1>
          </div>
        </div>

        {/* Status indicator */}
        <AgentStatus
          status={status}
          error={error}
          results={fullOutput?.flights ?? ((results ?? []) as unknown as Record<string, unknown>[])}
          onRetry={retry}
        />

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Execution Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ExecutionTimeline events={events} />
          </CardContent>
        </Card>

        {/* Agent Output JSON — shown after DB-persisted data is ready */}
        {isCompleted && fullOutput && (
          <div className="w-full">
            <div className="flex items-center justify-between rounded-t-lg border border-zinc-200 bg-zinc-100 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800">
              <button
                onClick={() => setJsonExpanded(!jsonExpanded)}
                className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                {jsonExpanded ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
                Agent Output ({fullOutput.flights.length} results)
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 gap-1.5 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="size-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    Copy JSON
                  </>
                )}
              </Button>
            </div>
            {jsonExpanded && (
              <pre className="max-h-96 overflow-auto rounded-b-lg border border-t-0 border-zinc-200 bg-zinc-950 p-4 text-xs leading-relaxed text-green-400 dark:border-zinc-700">
                {JSON.stringify(fullOutput, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Loading indicator while waiting for DB persistence */}
        {isCompleted && !fullOutput && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" />
            Saving results to database...
          </div>
        )}

        {/* View Results button — always shown when search completes */}
        {isCompleted && (
          <div className="flex justify-center">
            <Button
              onClick={() => router.push(`/results/${searchId}`)}
              size="sm"
            >
              View Results
              <ArrowRight className="ml-1 size-4" />
            </Button>
          </div>
        )}

        {/* Search ID for reference */}
        <p className="text-center text-xs text-zinc-400">
          Search ID: {searchId}
        </p>
      </div>
    </div>
  );
}
