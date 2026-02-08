"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plane } from "lucide-react";

import { ExecutionTimeline } from "@/components/ExecutionTimeline";
import { AgentStatus } from "@/components/AgentStatus";
import { useSearchExecution } from "@/components/ExecutionTimeline/hooks/useSearchExecution";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SearchExecutionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchId = params.id;

  const { status, events, error, results, retry } = useSearchExecution(searchId);

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-8 font-sans dark:bg-black">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Plane className="size-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              Flight Search
            </h1>
          </div>
        </div>

        {/* Status + JSON results + View Results button */}
        <AgentStatus
          status={status}
          error={error}
          results={results as Record<string, unknown>[] | undefined}
          onRetry={retry}
          onViewResults={() => router.push(`/results/${searchId}`)}
        />

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Execution Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ExecutionTimeline events={events} />
          </CardContent>
        </Card>

        {/* Search ID for reference */}
        <p className="text-center text-xs text-zinc-400">
          Search ID: {searchId}
        </p>
      </div>
    </div>
  );
}
