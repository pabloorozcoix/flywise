"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OllamaConnectionTest } from "./components/OllamaConnectionTest";
import { DatabaseConnectionTest } from "./components/DatabaseConnectionTest";
import { BrowserUseHealthTest } from "./components/BrowserUseHealthTest";
import { SystemStatus } from "./components/SystemStatus";

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
          <TabsTrigger value="ollama">Ollama</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="browser-use">Browser-Use</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="ollama" className="mt-4">
          <OllamaConnectionTest />
        </TabsContent>

        <TabsContent value="database" className="mt-4">
          <DatabaseConnectionTest />
        </TabsContent>

        <TabsContent value="browser-use" className="mt-4">
          <BrowserUseHealthTest />
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          <SystemStatus />
        </TabsContent>
      </Tabs>
    </div>
  );
}
