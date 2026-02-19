"use client";

import { SearchForm } from "@/components/SearchForm";
import { useFlightSearch } from "@/components/SearchForm/hooks/useFlightSearch";
import {
  Sparkles,
  Brain,
  Route,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";

export default function Home() {
  const { submitSearch, isSubmitting, error } = useFlightSearch();

  return (
    <main className="pb-20 pt-12">
      {/* Hero Section */}
      <div className="mx-auto mb-16 max-w-7xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-electric/30 bg-brand-electric/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-electric">
          <Sparkles className="size-3" />
          The Next Generation of Travel
        </div>
        <h1 className="mb-6 text-5xl font-black tracking-tight md:text-7xl">
          Fly Smarter. Let the AI <br />
          <span className="gradient-text">do the hunting.</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg font-light leading-relaxed text-slate-400">
          FlyWise uses advanced machine learning to find, negotiate, and book the
          most efficient flight paths in seconds.
        </p>
      </div>

      {/* Search Card */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-card-dark p-8 shadow-2xl">
          {/* Background decorative glows */}
          <div className="absolute -right-24 -top-24 size-64 rounded-full bg-brand-electric/10 blur-[100px]" />
          <div className="absolute -bottom-24 -left-24 size-64 rounded-full bg-brand-purple/10 blur-[100px]" />

          <div className="relative z-10">
            <SearchForm onSubmit={submitSearch} isSubmitting={isSubmitting} />
          </div>
        </div>

        {/* Trust indicator */}
        <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-slate-500">
          <BadgeCheck className="size-4 text-brand-electric" />
          FlyWise currently scanning 450+ airlines and private carriers
        </p>

        {/* Error Display */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Features Grid */}
      <div className="mx-auto mt-40 max-w-7xl px-6">
        <div className="mb-20 text-center">
          <h2 className="mb-4 text-4xl font-black">Autonomous Booking Power</h2>
          <p className="mx-auto max-w-xl font-light text-slate-400">
            Stop wasting hours on comparison sites. FlyWise handles the
            complexity of multi-hop itineraries and price negotiations.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Feature 1 */}
          <div className="group rounded-xl border border-white/5 bg-card-dark p-8 transition-colors hover:border-brand-electric/50">
            <div className="mb-6 flex size-14 items-center justify-center rounded-xl bg-brand-electric/10 transition-colors group-hover:bg-brand-electric/20">
              <Brain className="size-7 text-brand-electric" />
            </div>
            <h4 className="mb-3 text-xl font-bold">AI Price Negotiation</h4>
            <p className="text-sm leading-relaxed text-slate-400">
              FlyWise communicates directly with carrier APIs to secure
              exclusive rates not available on public GDS systems.
            </p>
          </div>
          {/* Feature 2 */}
          <div className="group rounded-xl border border-white/5 bg-card-dark p-8 transition-colors hover:border-brand-purple/50">
            <div className="mb-6 flex size-14 items-center justify-center rounded-xl bg-brand-purple/10 transition-colors group-hover:bg-brand-purple/20">
              <Route className="size-7 text-brand-purple" />
            </div>
            <h4 className="mb-3 text-xl font-bold">Multi-Hop Optimization</h4>
            <p className="text-sm leading-relaxed text-slate-400">
              Complex itineraries are solved in milliseconds, finding hidden city
              pairs and optimal layover durations.
            </p>
          </div>
          {/* Feature 3 */}
          <div className="group rounded-xl border border-white/5 bg-card-dark p-8 transition-colors hover:border-white/20">
            <div className="mb-6 flex size-14 items-center justify-center rounded-xl bg-white/5 transition-colors group-hover:bg-white/10">
              <ShieldCheck className="size-7 text-white" />
            </div>
            <h4 className="mb-3 text-xl font-bold">Concierge Monitoring</h4>
            <p className="text-sm leading-relaxed text-slate-400">
              Post-booking, FlyWise monitors your flight 24/7, automatically
              rebooking you if delays or cancellations occur.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
