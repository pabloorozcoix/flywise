"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plane,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Bot,
  Cloud,
  Square,
} from "lucide-react";

import { ExecutionTimeline } from "@/components/ExecutionTimeline";
import { AgentStatus } from "@/components/AgentStatus";
import { useSearchExecution } from "@/components/ExecutionTimeline/hooks/useSearchExecution";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LlmInfo {
  provider: string;
  model: string;
}

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

  // Terminate search state
  const [terminating, setTerminating] = useState(false);

  const handleTerminate = useCallback(async () => {
    setTerminating(true);
    try {
      const res = await fetch(`/api/search/${searchId}/cancel`, {
        method: "POST",
      });
      if (!res.ok && res.status !== 409) {
        // 409 = search already finished — not a real error
        const data = await res.json().catch(() => ({}));
        console.error("Failed to terminate:", data.detail || data.error || res.statusText);
      }
    } catch (err) {
      console.error("Terminate request failed:", err);
    } finally {
      setTerminating(false);
    }
  }, [searchId]);

  // Search params — fetched from agent_ctx (written at search start, always available)
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null);
  // LLM provider/model info
  const [llmInfo, setLlmInfo] = useState<LlmInfo | null>(null);
  // DB-persisted flight results (richer data with raw_data fallbacks)
  const [dbFlights, setDbFlights] = useState<Record<string, unknown>[] | null>(null);

  // Fetch search params from agent_ctx on mount (available immediately)
  useEffect(() => {
    const fetchParams = async () => {
      try {
        const res = await fetch(`/api/results/${searchId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.searchParams) {
          setSearchParams(data.searchParams);
        }
        if (data.llm) {
          setLlmInfo(data.llm);
        }
        if (data.results?.length > 0) {
          setDbFlights(data.results as Record<string, unknown>[]);
        }
      } catch {
        // ignore
      }
    };
    fetchParams();
  }, [searchId]);

  // Once search completes, poll DB for persisted results.
  // This enriches the display with DB data (raw_data fallbacks, proper IDs).
  useEffect(() => {
    if (status !== "completed" || dbFlights) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20;

    const poll = async () => {
      try {
        const res = await fetch(`/api/results/${searchId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.searchParams && !searchParams) {
          setSearchParams(data.searchParams);
        }
        if (data.results?.length > 0) {
          if (!cancelled) {
            setDbFlights(data.results as Record<string, unknown>[]);
          }
          return; // stop polling
        }
      } catch {
        // ignore
      }
      attempts++;
      if (attempts < maxAttempts && !cancelled) {
        setTimeout(poll, 2000);
      }
    };

    // Start polling quickly
    const timer = setTimeout(poll, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status, searchId, dbFlights, searchParams]);

  // JSON panel state
  const [jsonExpanded, setJsonExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const isCompleted = status === "completed";

  // Prefer DB results (richer), then WS results, then empty
  const wsResults = (results as unknown as Record<string, unknown>[]) ?? [];
  const flights: Record<string, unknown>[] = dbFlights ?? (wsResults.length > 0 ? wsResults : []);

  // Build the full output — show as soon as search completes
  const searchBlock = searchParams
    ? {
        origin: searchParams.origin,
        destination: searchParams.destination,
        departure_date: searchParams.departureDate,
        return_date: searchParams.returnDate ?? null,
        cabin_class: searchParams.cabinClass,
        direct_only: searchParams.directOnly,
      }
    : undefined;

  // Show Agent Output as soon as completed — don't gate on flights.length
  const fullOutput = isCompleted
    ? { search: searchBlock, flights }
    : null;

  const flightCount = flights.length;

  const handleCopy = () => {
    if (fullOutput) {
      navigator.clipboard.writeText(JSON.stringify(fullOutput, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/")}
          className="text-slate-400 hover:text-white"
        >
          <ArrowLeft className="mr-1 size-4" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <Plane className="size-5 text-brand-purple" />
          <h2 className="text-2xl font-black tracking-tight text-white">
            Flight Search
          </h2>
        </div>
      </div>

      {/* LLM Provider Badge */}
      {llmInfo && (
        <div className="mb-4 flex items-center justify-center gap-2">
          {llmInfo.provider === "openai" ? (
            <Badge variant="outline" className="gap-1.5 border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-400">
              <Cloud className="size-3" />
              OpenAI · {llmInfo.model}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 border-brand-purple/40 bg-brand-purple/10 px-3 py-1 text-xs font-bold text-brand-purple">
              <Bot className="size-3" />
              Ollama · {llmInfo.model}
            </Badge>
          )}
        </div>
      )}

      {/* Status indicator */}
      <div className="mb-8">
        <AgentStatus
          status={status}
          error={error}
          results={flights}
          onRetry={retry}
        />

        {/* Terminate button — visible while search is running */}
        {(status === "running" || status === "connecting") && (
          <div className="mt-4 flex justify-center">
            <Button
              onClick={handleTerminate}
              disabled={terminating}
              variant="outline"
              size="sm"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <Square className="mr-1 size-3.5 fill-current" />
              {terminating ? "Terminating..." : "Terminate"}
            </Button>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="agent-card mb-8 rounded-2xl p-6">
        <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-500">
          Execution Timeline
        </h3>
        <ExecutionTimeline events={events} />
      </div>

      {/* Agent Output JSON — shown as soon as search completes */}
      {isCompleted && fullOutput && (
        <div className="mb-8 w-full overflow-hidden rounded-2xl border border-white/10">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-3">
            <button
              onClick={() => setJsonExpanded(!jsonExpanded)}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-white"
            >
              {jsonExpanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
              Agent Output{flightCount > 0 ? ` (${flightCount} results)` : ""}
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 gap-1.5 text-xs text-slate-400 hover:text-white"
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
            <pre className="trace-log max-h-96 overflow-auto p-5 text-xs leading-relaxed">
              {JSON.stringify(fullOutput, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* View Results button — always shown when search completes */}
      {isCompleted && (
        <div className="mb-6 flex justify-center">
          <Button
            onClick={() => router.push(`/results/${searchId}`)}
            size="sm"
            className="gradient-accent glow-effect rounded-xl px-8 py-3 font-bold text-white"
          >
            View Results
            <ArrowRight className="ml-1 size-4" />
          </Button>
        </div>
      )}

      {/* Search ID for reference */}
      <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-600">
        Session: {searchId}
      </p>
    </main>
  );
}
