import { Settings } from "@/components/settings";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl py-10 px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">AeroAgent AI</h1>
          <ThemeToggle />
        </div>
        <Settings />
      </div>
    </main>
  );
}
