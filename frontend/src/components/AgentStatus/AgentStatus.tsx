"use client";

import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  RotateCcw,
} from "lucide-react";
import type { AgentStatusProps } from "./types";
import { Button } from "@/components/ui/button";

export function AgentStatus({
  status,
  error,
  results,
  onRetry,
}: AgentStatusProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Status indicator */}
      <div className="flex items-center gap-3">
        {status === "idle" && (
          <>
            <WifiOff className="size-5 text-slate-500" />
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
              Idle
            </span>
          </>
        )}
        {status === "connecting" && (
          <>
            <Loader2 className="size-5 animate-spin text-amber-400" />
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-400">
              Connecting...
            </span>
          </>
        )}
        {status === "running" && (
          <>
            <div className="relative">
              <Loader2 className="size-5 animate-spin text-brand-electric" />
              <span className="absolute -right-0.5 -top-0.5 size-2 animate-ping rounded-full bg-brand-electric" />
            </div>
            <span className="rounded-full border border-brand-electric/30 bg-brand-electric/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-electric">
              Agent is working...
            </span>
          </>
        )}
        {status === "completed" && (
          <>
            <CheckCircle2 className="size-5 text-emerald-400" />
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-400">
              Search complete
            </span>
            {results && results.length > 0 && (
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 font-mono text-xs font-bold text-slate-300">
                {results.length} flight{results.length !== 1 ? "s" : ""} found
              </span>
            )}
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="size-5 text-red-400" />
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-red-400">
              Error
            </span>
          </>
        )}
      </div>

      {/* Error message */}
      {status === "error" && error && (
        <p className="max-w-md text-center text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Retry button */}
      {status === "error" && onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="border-white/10 text-white hover:bg-white/10"
        >
          <RotateCcw className="mr-1 size-4" />
          Retry
        </Button>
      )}
    </div>
  );
}
