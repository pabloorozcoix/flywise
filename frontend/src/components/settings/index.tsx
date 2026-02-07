"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OllamaConnectionTest } from "./components/OllamaConnectionTest";
import { DatabaseConnectionTest } from "./components/DatabaseConnectionTest";

export function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Test and configure service connectivity
        </p>
      </div>

      <Tabs defaultValue="ollama" className="w-full">
        <TabsList>
          <TabsTrigger value="ollama">Ollama LLM</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
        </TabsList>

        <TabsContent value="ollama" className="mt-4">
          <OllamaConnectionTest />
        </TabsContent>

        <TabsContent value="database" className="mt-4">
          <DatabaseConnectionTest />
        </TabsContent>
      </Tabs>
    </div>
  );
}
