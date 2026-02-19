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
  Shield,
  XCircle,
} from "lucide-react";
import type { AgentEvent } from "@/lib/types/agentEvent";
import type { ExecutionTimelineProps } from "./types";
import { cn } from "@/lib/utils";

function getTimelineIcon(
  type: AgentEvent["type"],
  isLastProgress: boolean,
  statusCompleted: boolean
) {
  switch (type) {
    case "done":
      return (
        <div className="z-10 flex size-12 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          <CheckCircle2 className="size-5" />
        </div>
      );
    case "error":
      return (
        <div className="z-10 flex size-12 items-center justify-center rounded-full border-2 border-red-500 bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
          <AlertCircle className="size-5" />
        </div>
      );
    case "cancelled":
      return (
        <div className="z-10 flex size-12 items-center justify-center rounded-full border-2 border-amber-500 bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
          <XCircle className="size-5" />
        </div>
      );
    case "progress":
      if (isLastProgress) {
        return (
          <div className="z-10 flex size-12 items-center justify-center rounded-full gradient-accent text-white shadow-lg active-glow">
            <Globe className="size-5" />
          </div>
        );
      }
      return (
        <div className="z-10 flex size-12 items-center justify-center rounded-full border-2 border-brand-purple bg-zinc-800 text-brand-purple shadow-[0_0_15px_rgba(168,85,247,0.3)]">
          <Brain className="size-5" />
        </div>
      );
    case "status":
    default:
      if (statusCompleted) {
        return (
          <div className="z-10 flex size-12 items-center justify-center rounded-full border-2 border-emerald-500/60 bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="size-5" />
          </div>
        );
      }
      return (
        <div className="z-10 flex size-12 items-center justify-center rounded-full border border-white/5 bg-zinc-900 text-slate-600">
          <Shield className="size-5" />
        </div>
      );
  }
}

function getStatusBadge(
  type: AgentEvent["type"],
  isLastProgress: boolean,
  statusCompleted: boolean
) {
  switch (type) {
    case "done":
      return (
        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-green-400">
          Completed
        </span>
      );
    case "error":
      return (
        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-400">
          Error
        </span>
      );
    case "cancelled":
      return (
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-400">
          Cancelled
        </span>
      );
    case "progress":
      if (isLastProgress) {
        return (
          <span className="flex items-center gap-2 rounded-full border border-brand-electric/30 bg-brand-electric/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-electric">
            <span className="size-2 animate-pulse rounded-full bg-brand-electric" />
            In Progress
          </span>
        );
      }
      return (
        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-green-400">
          Completed
        </span>
      );
    case "status":
    default:
      if (statusCompleted) {
        return (
          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-green-400">
            Completed
          </span>
        );
      }
      return (
        <span className="rounded-full border border-white/5 bg-zinc-800 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
          Queueing
        </span>
      );
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
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <Loader2 className="mb-3 size-8 animate-spin text-brand-purple" />
        <p className="text-sm font-medium">Waiting for agent to start...</p>
      </div>
    );
  }

  // Find the index of the last progress event so we know which one should spin
  let lastProgressIndex = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === "progress") {
      lastProgressIndex = i;
      break;
    }
  }
  // If the search is done/errored, no progress event should spin
  const searchFinished = events.some((e) => e.type === "done" || e.type === "error" || e.type === "cancelled");
  // Find the index of the last status event
  let lastStatusIndex = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === "status") {
      lastStatusIndex = i;
      break;
    }
  }

  return (
    <div className="relative space-y-0">
      {events.map((event, index) => {
        const d = (event.data ?? {}) as {
          url?: string;
          thinking?: string;
          evaluation?: string;
          memory?: string;
          actions?: unknown[];
          screenshotUrl?: string;
          step?: number;
        };
        const hasDetails =
          event.type === "progress" && (d.thinking || d.evaluation || d.actions);
        const isExpanded = expandedEvents.has(event.id);
        const isLastProgress =
          !searchFinished && event.type === "progress" && index === lastProgressIndex;
        const isLast = index === events.length - 1;
        // A status event is "completed" if subsequent events exist after it or the search finished
        const statusCompleted =
          event.type === "status" && (searchFinished || index < events.length - 1);

        return (
          <div key={event.id} className="relative flex gap-8 pb-14 last:pb-0">
            {/* Icon + timeline line */}
            <div className="flex flex-col items-center">
              {getTimelineIcon(event.type, isLastProgress, statusCompleted)}
              {!isLast && (
                <div
                  className={cn(
                    "absolute top-12 w-0.5 h-full",
                    isLastProgress
                      ? "border-l-2 border-dashed border-zinc-700"
                      : "timeline-line"
                  )}
                />
              )}
            </div>

            {/* Content card */}
            <div
              className={cn(
                "w-full agent-card rounded-2xl overflow-hidden group",
                isLastProgress && "border-brand-electric/40",
                !isLastProgress &&
                  event.type !== "done" &&
                  event.type !== "error" &&
                  event.type === "status" &&
                  !statusCompleted &&
                  "opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all border-dashed border-white/10"
              )}
            >
              {/* Summary row */}
              <button
                onClick={() => hasDetails && toggleExpand(event.id)}
                className={cn(
                  "flex w-full items-center justify-between p-6 text-left",
                  hasDetails && "cursor-pointer"
                )}
              >
                <div>
                  <h3 className="text-lg font-bold text-white transition-colors group-hover:text-brand-purple">
                    {event.message}
                  </h3>
                  {d.url && (
                    <p className="mt-1 text-sm italic text-slate-400">
                      Interacting with:{" "}
                      <span className="font-medium text-brand-electric">
                        {String(d.url)}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="shrink-0 font-mono text-xs text-slate-500">
                    {format(new Date(event.timestamp), "HH:mm:ss")}
                  </span>
                  {getStatusBadge(event.type, isLastProgress, statusCompleted)}
                  {hasDetails && (
                    <span className="text-slate-500 transition-transform group-open:rotate-180">
                      {isExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded details */}
              {hasDetails && isExpanded && (
                <div className="border-t border-white/5 bg-black/20 px-6 pb-6">
                  <div className="mt-4 space-y-4 font-mono text-sm trace-log rounded-xl p-5">
                    {d.thinking && (
                      <div className="flex gap-4">
                        <Brain className="mt-0.5 size-4 shrink-0 text-brand-purple" />
                        <div>
                          <span className="font-bold text-brand-purple">Thinking:</span>{" "}
                          <span className="text-slate-300">{String(d.thinking)}</span>
                        </div>
                      </div>
                    )}
                    {d.evaluation && (
                      <div className="flex gap-4">
                        <Target className="mt-0.5 size-4 shrink-0 text-amber-400" />
                        <div>
                          <span className="font-bold text-amber-400">Evaluation:</span>{" "}
                          <span className="text-slate-300">{String(d.evaluation)}</span>
                        </div>
                      </div>
                    )}
                    {d.memory && (
                      <div className="flex gap-4">
                        <Info className="mt-0.5 size-4 shrink-0 text-cyan-400" />
                        <div>
                          <span className="font-bold text-cyan-400">Memory:</span>{" "}
                          <span className="text-slate-300">{String(d.memory)}</span>
                        </div>
                      </div>
                    )}
                    {Array.isArray(d.actions) && d.actions.length > 0 && (
                      <div className="flex gap-4">
                        <Zap className="mt-0.5 size-4 shrink-0 text-orange-400" />
                        <div>
                          <span className="font-bold text-orange-400">Actions:</span>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/60 p-3 text-[11px] text-slate-300 border border-white/5">
                            {JSON.stringify(d.actions, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                    {(event.screenshotUrl || d.screenshotUrl) && (
                      <div className="mt-2">
                        <img
                          src={String(event.screenshotUrl || d.screenshotUrl)}
                          alt={`Screenshot — Step ${d.step ?? index + 1}`}
                          className="w-full rounded-lg border border-white/10 shadow-lg"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
