"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, List } from "lucide-react";
import { ExecutionsTable } from "@/components/ExecutionsTable";
import type { ExecutionRow } from "@/lib/types/execution";
import { Button } from "@/components/ui/button";

export default function HistoryPage() {
  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchExecutions() {
      try {
        const res = await fetch("/api/executions");
        if (!res.ok) throw new Error("Failed to load results");
        const data = await res.json();
        setExecutions(data.executions ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchExecutions();
  }, []);

  const handleDelete = useCallback(async (searchId: string) => {
    const res = await fetch(`/api/executions/${searchId}`, { method: "DELETE" });
    if (!res.ok) return;
    setExecutions((prev) => prev.filter((e) => e.searchId !== searchId));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-slate-400 hover:text-white"
        >
          <Link href="/">
            <ArrowLeft className="mr-1 size-4" />
            Dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <List className="size-5 text-brand-purple" />
          <h2 className="text-2xl font-black tracking-tight text-white">
            History
          </h2>
          {!loading && !error && (
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
              <span className="font-mono text-[11px] font-bold text-slate-400">
                {executions.length} search{executions.length !== 1 ? "es" : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-8 text-center text-red-400">
          <p className="font-medium">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="mt-4 border-red-500/30 text-red-400 hover:bg-red-500/20"
          >
            Retry
          </Button>
        </div>
      ) : (
        <ExecutionsTable data={executions} loading={loading} onDelete={handleDelete} />
      )}
    </main>
  );
}
