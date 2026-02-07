"use client";

import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import type { AgentStatusProps } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AgentStatus({
  status,
  error,
  onRetry,
  onViewResults,
}: AgentStatusProps) {
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
