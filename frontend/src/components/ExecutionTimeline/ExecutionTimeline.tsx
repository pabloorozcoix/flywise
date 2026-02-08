"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  ChevronDown,
  ChevronRight,
  Globe,
  Brain,
  Target,
  Zap,
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
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length, autoScroll]);

  const toggleExpand = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

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

      {events.map((event, index) => {
        const d = (event.data ?? {}) as Record<string, unknown>;
        const hasDetails =
          event.type === "progress" && (d.thinking || d.evaluation || d.actions);
        const isExpanded = expandedEvents.has(event.id);

        return (
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
                {/* Expand toggle for progress events with details */}
                {hasDetails ? (
                  <button
                    onClick={() => toggleExpand(event.id)}
                    className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    aria-label={isExpanded ? "Collapse details" : "Expand details"}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                ) : null}
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

              {/* URL badge for progress steps */}
              {d.url ? (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Globe className="size-3" />
                  <span className="truncate">{String(d.url)}</span>
                </div>
              ) : null}

              {/* Expanded details panel */}
              {hasDetails && isExpanded ? (
                <div className="mt-2 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/50">
                  {d.thinking ? (
                    <div className="flex gap-2">
                      <Brain className="mt-0.5 size-3.5 shrink-0 text-purple-500" />
                      <div>
                        <span className="font-semibold text-purple-600 dark:text-purple-400">
                          Thinking:
                        </span>{" "}
                        <span className="text-zinc-600 dark:text-zinc-300">
                          {String(d.thinking)}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  {d.evaluation ? (
                    <div className="flex gap-2">
                      <Target className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                      <div>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          Evaluation:
                        </span>{" "}
                        <span className="text-zinc-600 dark:text-zinc-300">
                          {String(d.evaluation)}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  {d.memory ? (
                    <div className="flex gap-2">
                      <Info className="mt-0.5 size-3.5 shrink-0 text-cyan-500" />
                      <div>
                        <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                          Memory:
                        </span>{" "}
                        <span className="text-zinc-600 dark:text-zinc-300">
                          {String(d.memory)}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  {Array.isArray(d.actions) && d.actions.length > 0 ? (
                    <div className="flex gap-2">
                      <Zap className="mt-0.5 size-3.5 shrink-0 text-orange-500" />
                      <div>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">
                          Actions:
                        </span>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-zinc-100 p-1.5 text-[11px] dark:bg-zinc-900">
                          {JSON.stringify(d.actions, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Screenshot thumbnail */}
              {d.screenshotUrl ? (
                <div className="mt-2 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={String(d.screenshotUrl)}
                    alt={`Step ${index + 1} screenshot`}
                    className="max-h-48 w-full object-cover"
                  />
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
