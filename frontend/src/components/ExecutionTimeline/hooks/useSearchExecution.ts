"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  AgentEvent,
  SearchExecutionState,
  SearchExecutionStatus,
} from "@/lib/types/agentEvent";

const BROWSER_USE_WS_URL =
  typeof window !== "undefined"
    ? `ws://${window.location.hostname}:8000`
    : "ws://browser-use:8000";

/**
 * Hook to manage WebSocket connection to browser-use service
 * for real-time search execution updates.
 */
export function useSearchExecution(searchId: string) {
  const [state, setState] = useState<SearchExecutionState>({
    status: "idle",
    events: [],
  });
  const wsRef = useRef<WebSocket | null>(null);
  const eventCounterRef = useRef(0);

  const addEvent = useCallback(
    (type: AgentEvent["type"], message: string, data?: Record<string, unknown>) => {
      const event: AgentEvent = {
        id: `${searchId}-${eventCounterRef.current++}`,
        timestamp: new Date().toISOString(),
        type,
        message,
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
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setState((prev) => ({ ...prev, status: "connecting" }));
    addEvent("status", "Connecting to agent...");

    const ws = new WebSocket(`${BROWSER_USE_WS_URL}/ws/search/${searchId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((prev) => ({ ...prev, status: "running" }));
      addEvent("status", "Connected — starting search");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "status":
            addEvent("status", data.message);
            break;
          case "progress":
            setState((prev) => ({ ...prev, status: "running" }));
            addEvent("progress", data.message, {
              screenshotUrl: data.screenshot_url,
            });
            break;
          case "done":
            setState((prev) => ({
              ...prev,
              status: "completed",
              results: data.results,
            }));
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
          default:
            addEvent("progress", data.message || JSON.stringify(data));
        }
      } catch {
        addEvent("progress", event.data);
      }
    };

    ws.onerror = () => {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "WebSocket connection error",
      }));
      addEvent("error", "Connection error — trying polling fallback");
    };

    ws.onclose = () => {
      setState((prev) => {
        if (prev.status === "running" || prev.status === "connecting") {
          return {
            ...prev,
            status: "error",
            error: "Connection closed unexpectedly",
          };
        }
        return prev;
      });
    };
  }, [searchId, addEvent]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const retry = useCallback(() => {
    disconnect();
    eventCounterRef.current = 0;
    setState({ status: "idle", events: [] });
    setTimeout(connect, 100);
  }, [connect, disconnect]);

  // Poll fallback when WebSocket fails
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/status/${searchId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "completed") {
          setState((prev) => ({
            ...prev,
            status: "completed",
            results: data.results,
          }));
          addEvent("done", "Search complete (via polling)");
        } else if (data.status === "failed") {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: data.error || "Search failed",
          }));
          addEvent("error", data.error || "Search failed");
        }
      }
    } catch {
      // Polling silently fails, will retry
    }
  }, [searchId, addEvent]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  // Polling fallback when WebSocket errors
  useEffect(() => {
    if (state.status !== "error") return;

    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [state.status, pollStatus]);

  return {
    ...state,
    connect,
    disconnect,
    retry,
  };
}
