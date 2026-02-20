import {
  Compass,
  Search,
  Clock,
  Settings,
  Layers,
  Container,
  FlaskConical,
  Brain,
  Plug,
  Users,
} from "lucide-react";

const teamMembers = [
  { name: "Ale Alfaro", role: "Product Owner" },
  { name: "Luis Martinez", role: "UI/UX Designer" },
  { name: "Kevin Martinez", role: "Software Engineer" },
  { name: "Jesús Sánchez", role: "Software Engineer" },
  { name: "Pablo Orozco", role: "Tech Lead / Software Engineer" },
];

export default function CreditsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      {/* Page header */}
      <div className="mb-12">
        <h1 className="text-3xl font-black tracking-tight text-white">
          Credits
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Learn how to use FlyWise, what powers it, and who built it
        </p>
      </div>

      {/* ─── Section 1: How to Use the App ─── */}
      <section className="mb-14">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-brand-electric/10">
            <Compass className="size-5 text-brand-electric" />
          </div>
          <h2 className="text-xl font-bold text-white">How to Use FlyWise</h2>
        </div>

        <div className="space-y-6">
          <FeatureBlock
            icon={<Search className="size-4 text-brand-electric" />}
            title="Flight Search"
            description="From the Dashboard, fill in your origin, destination, travel dates, number of passengers, and cabin class. Hit &quot;Search Flights&quot; and FlyWise's AI agent will autonomously browse real airline websites to find the best options — no API keys, no third-party flight aggregators."
          />
          <FeatureBlock
            icon={<Clock className="size-4 text-brand-purple" />}
            title="Execution Timeline"
            description="After submitting a search, you're taken to a live Execution Timeline. Watch the AI agent's progress in real time via WebSocket updates — every page navigation, data extraction step, and reasoning action is streamed to your browser so you always know what's happening."
          />
          <FeatureBlock
            icon={<Layers className="size-4 text-green-400" />}
            title="History & Results"
            description="All past searches are saved in the History page. Click any previous search to review the flights found, sorted by price, duration, or number of stops. Each result card shows airline, times, layovers, and price."
          />
          <FeatureBlock
            icon={<Settings className="size-4 text-amber-400" />}
            title="Settings"
            description="The Settings page lets you verify connectivity to every service — Ollama (LLM), Browser-Use (automation), and PostgreSQL (database). Green checks mean healthy; red indicators help you diagnose issues instantly."
          />
        </div>
      </section>

      {/* ─── Section 2: About the Project ─── */}
      <section className="mb-14">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-brand-purple/10">
            <Layers className="size-5 text-brand-purple" />
          </div>
          <h2 className="text-xl font-bold text-white">About the Project</h2>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-slate-400">
          FlyWise (AeroAgent AI) is a <strong className="text-white">100% local, privacy-first</strong> flight
          search application. Everything runs on your machine inside Docker containers — no data
          leaves your network, no cloud API keys required.
        </p>

        <div className="space-y-6">
          <FeatureBlock
            icon={<Container className="size-4 text-brand-electric" />}
            title="The Stack & Containers"
            description="Four Docker services orchestrated via Docker Compose: (1) Next.js 16 — TypeScript frontend with App Router and shadcn/ui, (2) Ollama — runs the local language model, (3) Browser-Use — Python FastAPI service wrapping the browser-use library with Chromium for autonomous web browsing, and (4) PostgreSQL + pgvector — Supabase Postgres image for search history, agent state, and vector embeddings."
          />
          <FeatureBlock
            icon={<FlaskConical className="size-4 text-green-400" />}
            title="Testing"
            description="The browser-use Python service targets 100% test coverage with pytest, pytest-asyncio, and pytest-cov. Tests are split into unit tests (models, parsers, prompts, config) and integration tests (routes, services, WebSocket). The Next.js frontend uses Vitest and React Testing Library for component and page tests. A pre-commit hook (Husky + lint-staged) runs ESLint, TypeScript type checking, and all tests before every commit."
          />
          <FeatureBlock
            icon={<Brain className="size-4 text-brand-purple" />}
            title="Local, Private Small Language Model"
            description="FlyWise uses Ollama to run an open-source small language model (e.g. Qwen 3 8B) entirely on your hardware. The model powers the browser agent's reasoning — deciding which pages to visit, what data to extract, and how to handle anti-bot challenges. Because inference runs locally, your search data never leaves your machine."
          />
          <FeatureBlock
            icon={<Plug className="size-4 text-amber-400" />}
            title="Extensibility"
            description="The architecture is not limited to flights. The same agent-browsing pattern can be adapted to any task that a human would perform in a web browser: ordering food delivery, comparing hotel prices, filling out forms, monitoring product availability, or automating repetitive workflows. Swap the prompts, point the agent at a different website, and you have a new autonomous tool — all still 100% local and private."
          />
        </div>
      </section>

      {/* ─── Section 3: Authors ─── */}
      <section>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-green-500/10">
            <Users className="size-5 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Authors</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {teamMembers.map((member) => (
            <div
              key={member.name}
              className="rounded-xl border border-white/10 bg-card-dark p-5 transition-colors hover:border-brand-purple/30"
            >
              <p className="font-bold text-white">{member.name}</p>
              <p className="mt-1 text-sm text-slate-400">{member.role}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

/* ─── Reusable sub-component ─── */

function FeatureBlock({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-card-dark p-5">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}
