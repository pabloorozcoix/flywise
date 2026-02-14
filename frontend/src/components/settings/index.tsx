"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OllamaConnectionTest } from "./components/OllamaConnectionTest";
import { DatabaseConnectionTest } from "./components/DatabaseConnectionTest";
import { BrowserUseHealthTest } from "./components/BrowserUseHealthTest";
import { SystemStatus } from "./components/SystemStatus";

export function Settings() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="ollama" className="w-full">
        <TabsList className="rounded-xl border border-white/10 bg-white/5">
          <TabsTrigger value="ollama" className="rounded-lg text-xs font-bold uppercase tracking-widest data-[state=active]:bg-brand-electric data-[state=active]:text-white">Ollama</TabsTrigger>
          <TabsTrigger value="database" className="rounded-lg text-xs font-bold uppercase tracking-widest data-[state=active]:bg-brand-electric data-[state=active]:text-white">Database</TabsTrigger>
          <TabsTrigger value="browser-use" className="rounded-lg text-xs font-bold uppercase tracking-widest data-[state=active]:bg-brand-electric data-[state=active]:text-white">Browser-Use</TabsTrigger>
          <TabsTrigger value="system" className="rounded-lg text-xs font-bold uppercase tracking-widest data-[state=active]:bg-brand-electric data-[state=active]:text-white">System</TabsTrigger>
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
