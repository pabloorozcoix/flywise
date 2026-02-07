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
import { useDatabaseConnectionTest } from "./hooks/useDatabaseConnectionTest";

export function DatabaseConnectionTest() {
  const {
    connectionResult,
    pgvectorResult,
    error,
    isPending,
    handleTestConnection,
    handleTestPgvector,
  } = useDatabaseConnectionTest();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          PostgreSQL + pgvector
          {connectionResult?.status === "connected" && (
            <Badge variant="default" className="bg-green-600">
              Connected
            </Badge>
          )}
          {error && <Badge variant="destructive">Error</Badge>}
        </CardTitle>
        <CardDescription>
          Test connectivity to the PostgreSQL database and pgvector extension
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={handleTestConnection} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Database
          </Button>
          <Button
            onClick={handleTestPgvector}
            disabled={isPending}
            variant="secondary"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test pgvector
          </Button>
        </div>

        {connectionResult && (
          <div className="rounded-md border bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">Connection successful</p>
            <p className="text-xs text-muted-foreground font-mono">
              {connectionResult.version}
            </p>
          </div>
        )}

        {pgvectorResult && (
          <div className="rounded-md border bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">pgvector extension active</p>
            <p className="text-xs text-muted-foreground">
              Version: {pgvectorResult.pgvectorVersion}
            </p>
            {pgvectorResult.test && (
              <div className="text-xs text-muted-foreground font-mono">
                <p>Nearest vector ID: {pgvectorResult.test.nearestId}</p>
                <p>Distance: {pgvectorResult.test.distance}</p>
              </div>
            )}
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
