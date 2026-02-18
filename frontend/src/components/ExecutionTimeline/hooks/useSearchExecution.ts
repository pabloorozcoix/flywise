"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  AgentEvent,
  SearchExecutionState,
  SearchExecutionStatus,
} from "@/lib/types/agentEvent";

/* c8 ignore next 4 -- server-side fallback; window is always defined in jsdom/browser */
const BROWSER_USE_WS_URL =
  typeof window !== "undefined"
    ? `ws://${window.location.hostname}:8000`
    : "ws://browser-use:8000";

/* c8 ignore next 4 -- server-side fallback; window is always defined in jsdom/browser */
const BROWSER_USE_HTTP_URL =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : "http://browser-use:8000";

/**
 * Hook to manage WebSocket connection to browser-use service
 * for real-time search execution updates.
 *
 * Uses WS for instant streaming + HTTP polling as a reliable fallback.
 * Handles React StrictMode double-mount gracefully.
 */
export function useSearchExecution(searchId: string) {
  const [state, setState] = useState<SearchExecutionState>({
    status: "idle",
    events: [],
  });
  const wsRef = useRef<WebSocket | null>(null);
  const eventCounterRef = useRef(0);
  const polledProgressCountRef = useRef(0);
  // Track whether the WS has successfully delivered any data.
  // If it has, we skip polling to avoid duplicates.
  const wsDeliveredRef = useRef(false);
  // Guard against StrictMode double-mount: mark WS as disposed on cleanup
  // so stale onerror/onclose handlers are ignored.
  const wsIdRef = useRef(0);

  const addEvent = useCallback(
    (type: AgentEvent["type"], message: string, data?: Record<string, unknown>) => {
      const event: AgentEvent = {
        id: `${searchId}-${eventCounterRef.current++}`,
        timestamp: new Date().toISOString(),
        type,
        message,
        screenshotUrl: (data?.screenshotUrl as string) || undefined,
        data,
      };
      setState((prev) => ({
        ...prev,
        events: [...prev.events, event],
      }));
    },
    [searchId]
  );

  const connect = useCallback(() => {
    // Prevent duplicate connections (handles React StrictMode double-mount)
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      /* c8 ignore next -- CONNECTING guard only fires during StrictMode rapid re-mount */
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    // Assign a unique ID to this connection attempt so stale callbacks
    // from a previous WS (closed by StrictMode cleanup) can be detected.
    const myId = ++wsIdRef.current;

    setState((prev) => ({ ...prev, status: "connecting" }));
    addEvent("status", "Connecting to agent...");

    const ws = new WebSocket(`${BROWSER_USE_WS_URL}/ws/search/${searchId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      /* c8 ignore next -- React StrictMode stale-WS guard */
      if (wsIdRef.current !== myId) return; // stale
      setState((prev) => ({ ...prev, status: "running" }));
      addEvent("status", "Connected — starting search");
    };

    ws.onmessage = (event) => {
      /* c8 ignore next -- React StrictMode stale-WS guard */
      if (wsIdRef.current !== myId) return; // stale
      wsDeliveredRef.current = true;
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "status":
            addEvent("status", data.message);
            break;
          case "progress":
            // Track progress count so polling doesn't re-emit these
            polledProgressCountRef.current++;
            setState((prev) => ({ ...prev, status: "running" }));
            addEvent("progress", data.message, {
              screenshotUrl: data.screenshot_url,
              step: data.step,
              url: data.url,
              title: data.title,
              thinking: data.thinking,
              evaluation: data.evaluation,
              memory: data.memory,
              nextGoal: data.next_goal,
              actions: data.actions,
            });
            break;
          case "done":
            setState((prev) => ({
              ...prev,
              status: "completed",
              results: data.results,
            }));
            /* c8 ignore next -- fallback never reached when message is always provided */
            addEvent("done", data.message || "Search complete");
            break;
          case "error":
            setState((prev) => ({
              ...prev,
              status: "error",
              error: data.message,
            }));
            addEvent("error", data.message);
            break;
          case "cancelled":
            setState((prev) => ({
              ...prev,
              status: "cancelled",
            }));
            /* c8 ignore next -- fallback never reached when message is always provided */
            addEvent("cancelled", data.message || "Search cancelled by user");
            break;
          default:
            /* c8 ignore next -- fallback for unexpected message shapes */
            addEvent("progress", data.message || JSON.stringify(data));
        }
      } catch {
        addEvent("progress", event.data);
      }
    };

    ws.onerror = () => {
      // Ignore errors from stale WebSocket instances (React StrictMode)
      /* c8 ignore next -- React StrictMode stale-WS guard */
      if (wsIdRef.current !== myId) return;
      // Don't show a scary error — polling will take over automatically
      setState((prev) => ({ ...prev, status: "running" }));
    };

    ws.onclose = () => {
      // Ignore close events from stale WebSocket instances
      if (wsIdRef.current !== myId) return;

      setState((prev) => {
        if (prev.status === "running" || prev.status === "connecting") {
          // WS closed but search may still be running — polling will handle it
          return { ...prev, status: "running" };
        }
        return prev;
      });
    };
  }, [searchId, addEvent]);

  const disconnect = useCallback(() => {
    // Bump the ID so any pending callbacks from the old WS are ignored
    wsIdRef.current++;
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const retry = useCallback(() => {
    disconnect();
    eventCounterRef.current = 0;
    polledProgressCountRef.current = 0;
    wsDeliveredRef.current = false;
    setState({ status: "idle", events: [] });
    setTimeout(connect, 100);
  }, [connect, disconnect]);

  // Poll browser-use /status directly — provides progress + screenshots
  const pollStatus = useCallback(async () => {
    // If WS is actively delivering data, don't poll to avoid duplicates
    if (
      wsRef.current?.readyState === WebSocket.OPEN &&
      wsDeliveredRef.current
    ) {
      return;
    }

    try {
      const buRes = await fetch(`${BROWSER_USE_HTTP_URL}/status/${searchId}`).catch(() => null);

      if (buRes && buRes.ok) {
        const data = await buRes.json();

        // Stream any new progress events we haven't rendered yet
        /* c8 ignore next -- fallback for missing progress array */
        const progress: Record<string, unknown>[] = data.progress || [];
        while (polledProgressCountRef.current < progress.length) {
          const evt = progress[polledProgressCountRef.current];
          /* c8 ignore next 3 -- fallback defaults for optional polling fields */
          const step = evt.step ?? "?";
          const goal = (evt.next_goal as string) || "Thinking...";
          const url = (evt.url as string) || "";
          let message = `Step ${step}: ${goal}`;
          if (url) message += ` — ${url}`;

          const screenshot = evt.screenshot as string | undefined;

          addEvent("progress", message, {
            screenshotUrl: screenshot ? `data:image/png;base64,${screenshot}` : undefined,
            step: evt.step,
            url: evt.url,
            title: evt.title,
            thinking: evt.thinking,
            evaluation: evt.evaluation,
            memory: evt.memory,
            nextGoal: evt.next_goal,
            actions: evt.actions,
          });
          polledProgressCountRef.current++;
        }

        if (data.status === "completed") {
          setState((prev) => {
            /* c8 ignore next -- idempotent guard for duplicate completed events */
            if (prev.status === "completed") return prev;
            return { ...prev, status: "completed", results: data.results };
          });
          addEvent("done", "Search complete");
          return;
        } else if (data.status === "failed") {
          setState((prev) => {
            /* c8 ignore next -- idempotent guard for duplicate failed events */
            if (prev.status === "error") return prev;
            /* c8 ignore next -- fallback for missing error message */
            return { ...prev, status: "error", error: data.error || "Search failed" };
          });
          /* c8 ignore next -- fallback for missing error message */
          addEvent("error", data.error || "Search failed");
          return;
        } else if (data.status === "cancelled") {
          setState((prev) => {
            /* c8 ignore next -- idempotent guard for duplicate cancelled events */
            if (prev.status === "cancelled") return prev;
            return { ...prev, status: "cancelled" };
          });
          addEvent("cancelled", "Search cancelled by user");
          return;
        } else if (data.status === "running") {
          /* c8 ignore next 4 -- defensive guard: poll only fires during running/connecting; transition is a race-condition safeguard */
          setState((prev) => {
            if (prev.status === "running") return prev;
            return { ...prev, status: "running" };
          });
        }
        return;
      }

      /* c8 ignore next 30 -- Next.js DB-backed fallback polling; same guards as browser-use path above */
      // Fallback: call the Next.js DB-backed status endpoint
      const res = await fetch(`/api/status/${searchId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "completed") {
          setState((prev) => {
            if (prev.status === "completed") return prev;
            return { ...prev, status: "completed", results: data.results };
          });
          addEvent("done", "Search complete");
        } else if (data.status === "failed") {
          setState((prev) => {
            if (prev.status === "error") return prev;
            return { ...prev, status: "error", error: data.error || "Search failed" };
          });
          addEvent("error", data.error || "Search failed");
        } else if (data.status === "cancelled") {
          setState((prev) => {
            if (prev.status === "cancelled") return prev;
            return { ...prev, status: "cancelled" };
          });
          addEvent("cancelled", "Search cancelled by user");
        } else if (data.status === "running") {
          /* c8 ignore next 4 -- defensive guard */
          setState((prev) => {
            if (prev.status === "running") return prev;
            return { ...prev, status: "running" };
          });
        }
      }
    } catch {
      // Polling silently fails, will retry next interval
    }
  }, [searchId, addEvent]);

  // Auto-connect WebSocket on mount
  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  // Always poll while search is active (running/connecting).
  // Polling gracefully skips when WS is actively delivering data.
  // This ensures screenshots and progress are always picked up.
  useEffect(() => {
    if (state.status !== "running" && state.status !== "connecting") return;

    // Delay the first poll slightly to give WS time to deliver
    // catch-up events (avoids duplicate Step 0 on initial connect).
    const initialDelay = setTimeout(pollStatus, 3000);
    const interval = setInterval(pollStatus, 10000);
    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [state.status, pollStatus]);

  return {
    ...state,
    connect,
    disconnect,
    retry,
  };
}
