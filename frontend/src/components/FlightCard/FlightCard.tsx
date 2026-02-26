"use client";

import { format } from "date-fns";
import { Plane, ExternalLink, ShieldCheck, ShieldAlert, Award, DollarSign } from "lucide-react";
import type { FlightCardProps } from "./types";

export function FlightCard({ flight, rank }: FlightCardProps) {
  const formattedDeparture = safeFormatTime(flight.departure);
  const formattedArrival = safeFormatTime(flight.arrival);

  return (
    <div className="glass-card relative overflow-hidden rounded-3xl">
      <div className="p-8">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          {/* Airline info */}
          <div className="flex items-center gap-4 lg:col-span-3">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2">
              <Plane className="size-7 text-slate-300" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-tight text-white">
                {flight.airline}
              </h4>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {flight.origin} &bull; {flight.destination}
              </p>
            </div>
          </div>

          {/* Times */}
          <div className="lg:col-span-6">
            <div className="flex items-center justify-between gap-4">
              <div className="text-left">
                <p className="font-mono text-2xl font-bold text-white">
                  {formattedDeparture}
                </p>
                {flight.origin && (
                  <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">
                    {flight.origin}
                  </p>
                )}
              </div>

              <div className="flex flex-grow flex-col items-center px-8">
                <span className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {flight.duration}
                </span>
                <div className="relative flex w-full items-center justify-center">
                  <div className="h-px w-full bg-white/10" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-purple/50 to-transparent" />
                  <span className="absolute size-2 rounded-full bg-brand-purple shadow-lg shadow-purple-500/50" />
                </div>
                <span className="mt-2 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  {flight.stops === 0
                    ? "Non-stop"
                    : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
                </span>
              </div>

              <div className="text-right">
                <p className="font-mono text-2xl font-bold text-white">
                  {formattedArrival}
                </p>
                {flight.destination && (
                  <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">
                    {flight.destination}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Price & action */}
          <div className="flex flex-row items-center justify-between gap-4 border-t border-white/5 pt-6 lg:col-span-3 lg:flex-col lg:items-end lg:justify-center lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            {/* Badge — rank indicator */}
            {rank === 1 && (
              <span className="flex items-center gap-2 self-end rounded-full bg-brand-purple px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">
                <Award className="size-3" /> Best Value
              </span>
            )}
            {rank === 2 && (
              <span className="flex items-center gap-2 self-end rounded-full bg-emerald-500 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-near-black">
                <DollarSign className="size-3" /> Cheapest
              </span>
            )}
            <div className="text-right">
              {/* Verification badge */}
              {flight.verified ? (
                <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                  <ShieldCheck className="mr-1 inline size-3" />
                  Verified
                </p>
              ) : (
                <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                  <ShieldAlert className="mr-1 inline size-3" />
                  Unverified
                </p>
              )}
              <p className="font-mono text-4xl font-black leading-none text-white">
                {flight.currency === "USD" ? "$" : flight.currency}
                {flight.price.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
                <span className="text-base font-normal text-slate-500">.00</span>
              </p>
            </div>
            {flight.url ? (
              <a
                href={flight.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-2xl bg-white px-8 py-3 text-center text-[11px] font-black uppercase tracking-widest text-near-black shadow-xl shadow-white/5 transition-all hover:scale-105 hover:bg-brand-electric hover:text-white active:scale-95 lg:w-auto"
              >
                Select
                <ExternalLink className="ml-1 inline size-3" />
              </a>
            ) : (
              <button className="w-full rounded-2xl bg-white px-8 py-3 text-[11px] font-black uppercase tracking-widest text-near-black shadow-xl shadow-white/5 transition-all hover:scale-105 hover:bg-brand-electric hover:text-white active:scale-95 lg:w-auto">
                Select
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Safely format a time string — handles ISO dates and plain time strings */
function safeFormatTime(value: string): string {
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return format(date, "HH:mm");
    }
  /* c8 ignore next 2 -- new Date() never throws in JavaScript; catch is unreachable */
  } catch {
  }
  return value;
}
