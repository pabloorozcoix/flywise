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
import { useSystemStatus } from "./hooks/useSystemStatus";

export function SystemStatus() {
  const { result, error, isPending, handleRefresh } = useSystemStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          System Overview
          {result?.status === "healthy" && (
            <Badge variant="default" className="bg-green-600">
              All Healthy
            </Badge>
          )}
          {result?.status === "degraded" && (
            <Badge variant="secondary" className="bg-yellow-600 text-white">
              Degraded
            </Badge>
          )}
          {error && <Badge variant="destructive">Error</Badge>}
        </CardTitle>
        <CardDescription>
          Aggregate health status of all services and database table counts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleRefresh} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? "Checking…" : "Check All Services"}
        </Button>

        {result && (
          <div className="space-y-4">
            {/* Service statuses */}
            <div className="rounded-md border bg-muted p-4 space-y-3">
              <p className="text-sm font-medium">Service Health</p>
              {result.services.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-mono">{service.name}</span>
                  <div className="flex items-center gap-2">
                    {service.latencyMs !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {service.latencyMs}ms
                      </span>
                    )}
                    <Badge
                      variant={
                        service.status === "healthy" ? "default" : "destructive"
                      }
                      className={
                        service.status === "healthy" ? "bg-green-600" : ""
                      }
                    >
                      {service.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {/* Table row counts */}
            {Object.keys(result.tableCounts).length > 0 && (
              <div className="rounded-md border bg-muted p-4 space-y-3">
                <p className="text-sm font-medium">Database Tables</p>
                {Object.entries(result.tableCounts).map(([table, count]) => (
                  <div
                    key={table}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-mono">{table}</span>
                    <span className="text-muted-foreground">
                      {count >= 0 ? `${count} rows` : "not found"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground">
              Last checked: {new Date(result.timestamp).toLocaleString()}
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
