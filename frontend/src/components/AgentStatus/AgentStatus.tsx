"use client";

import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  ArrowRight,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from "lucide-react";
import type { AgentStatusProps } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AgentStatus({
  status,
  error,
  results,
  onRetry,
  onViewResults,
}: AgentStatusProps) {
  const [jsonExpanded, setJsonExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (results) {
      navigator.clipboard.writeText(JSON.stringify(results, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        {status === "idle" && (
          <>
            <WifiOff className="size-5 text-zinc-400" />
            <Badge variant="secondary">Idle</Badge>
          </>
        )}
        {status === "connecting" && (
          <>
            <Loader2 className="size-5 animate-spin text-yellow-500" />
            <Badge variant="secondary">Connecting...</Badge>
          </>
        )}
        {status === "running" && (
          <>
            <Loader2 className="size-5 animate-spin text-blue-500" />
            <Badge variant="default">Agent is working...</Badge>
          </>
        )}
        {status === "completed" && (
          <>
            <CheckCircle2 className="size-5 text-green-500" />
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Search complete
            </Badge>
            {results && results.length > 0 && (
              <Badge variant="secondary">
                {results.length} flight{results.length !== 1 ? "s" : ""} found
              </Badge>
            )}
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="size-5 text-red-500" />
            <Badge variant="destructive">Error</Badge>
          </>
        )}
      </div>

      {/* Error message */}
      {status === "error" && error && (
        <p className="max-w-md text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Flight results JSON output */}
      {status === "completed" && results && results.length > 0 && (
        <div className="w-full max-w-2xl">
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
              Agent Output ({results.length} results)
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
              {JSON.stringify(results, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {status === "completed" && onViewResults && (
          <Button onClick={onViewResults} size="sm">
            View Results
            <ArrowRight className="ml-1 size-4" />
          </Button>
        )}
        {status === "error" && onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm">
            <RotateCcw className="mr-1 size-4" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
