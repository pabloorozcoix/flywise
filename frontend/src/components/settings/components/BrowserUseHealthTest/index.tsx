"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useBrowserUseHealthTest } from "./hooks/useBrowserUseHealthTest";

export function BrowserUseHealthTest() {
  const { result, error, isPending, handleTest } = useBrowserUseHealthTest();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Browser-Use Service
          {result?.status === "ok" && (
            <Badge variant="default" className="bg-green-600">
              Healthy
            </Badge>
          )}
          {error && <Badge variant="destructive">Error</Badge>}
        </CardTitle>
        <CardDescription>
          Test connectivity to the browser-use FastAPI service (Chromium +
          browser-use agent)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleTest} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? "Testing…" : "Test Browser-Use"}
        </Button>

        {result && (
          <div className="rounded-md border bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">Service is healthy</p>
            <p className="text-xs text-muted-foreground font-mono">
              Status: {result.serviceStatus}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              URL: {result.url}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
