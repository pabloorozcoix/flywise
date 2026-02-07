"use client";

import { useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";
import type { AgentEvent } from "@/lib/types/agentEvent";
import type { ExecutionTimelineProps } from "./types";
import { cn } from "@/lib/utils";

function getEventIcon(type: AgentEvent["type"]) {
  switch (type) {
    case "done":
      return <CheckCircle2 className="size-5 text-green-500" />;
    case "error":
      return <AlertCircle className="size-5 text-red-500" />;
    case "progress":
      return <Loader2 className="size-5 animate-spin text-blue-500" />;
    case "status":
    default:
      return <Info className="size-5 text-zinc-400" />;
  }
}

function getEventColor(type: AgentEvent["type"]) {
  switch (type) {
    case "done":
      return "border-green-500";
    case "error":
      return "border-red-500";
    case "progress":
      return "border-blue-500";
    case "status":
    default:
      return "border-zinc-300 dark:border-zinc-600";
  }
}

export function ExecutionTimeline({
  events,
  autoScroll = true,
}: ExecutionTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length, autoScroll]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
        <Loader2 className="mb-3 size-8 animate-spin" />
        <p>Waiting for agent to start...</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-[18px] top-3 bottom-3 w-px bg-zinc-200 dark:bg-zinc-700" />

      {events.map((event, index) => (
        <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
          {/* Icon dot */}
          <div
            className={cn(
              "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 bg-white dark:bg-zinc-900",
              getEventColor(event.type)
            )}
          >
            {getEventIcon(event.type)}
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
            <div className="flex items-baseline gap-2">
              <p
                className={cn(
                  "text-sm font-medium",
                  event.type === "error"
                    ? "text-red-600 dark:text-red-400"
                    : event.type === "done"
                      ? "text-green-600 dark:text-green-400"
                      : "text-zinc-900 dark:text-zinc-100"
                )}
              >
                {event.message}
              </p>
              <span className="shrink-0 text-xs text-zinc-400">
                {format(new Date(event.timestamp), "HH:mm:ss")}
              </span>
            </div>

            {/* Screenshot thumbnail */}
            {event.screenshotUrl && (
              <div className="mt-2 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.screenshotUrl}
                  alt={`Step ${index + 1} screenshot`}
                  className="max-h-48 w-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
