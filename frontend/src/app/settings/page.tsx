import { Settings } from "@/components/settings";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Service connectivity &amp; diagnostics</p>
      </div>
      <Settings />
    </main>
  );
}
