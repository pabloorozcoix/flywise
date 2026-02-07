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
import { useOllamaConnectionTest } from "./hooks/useOllamaConnectionTest";

export function OllamaConnectionTest() {
  const { text, error, isPending, handleTest } = useOllamaConnectionTest();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Ollama LLM
          {text && !error && (
            <Badge variant="default" className="bg-green-600">
              Connected
            </Badge>
          )}
          {error && <Badge variant="destructive">Error</Badge>}
        </CardTitle>
        <CardDescription>
          Test connectivity to the local Ollama LLM service (gpt-oss:20b)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleTest} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? "Testing…" : "Test Ollama"}
        </Button>

        {text && (
          <div className="rounded-md border bg-muted p-4">
            <p className="text-sm font-mono whitespace-pre-wrap">{text}</p>
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
