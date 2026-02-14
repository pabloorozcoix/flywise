"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plane,
  Loader2,
  SearchX,
  ChevronDown,
} from "lucide-react";

import { FlightCard } from "@/components/FlightCard";
import type { FlightResult, FlightSortField, SortDirection } from "@/lib/types/flightResult";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


interface SearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  cabinClass: string;
  directOnly: boolean;
}

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchId = params.id;

  const [results, setResults] = useState<FlightResult[]>([]);
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sort & filter state
  const [sortField, setSortField] = useState<FlightSortField>("price");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [directOnly, setDirectOnly] = useState(false);

  // Fetch results
  useEffect(() => {
    async function fetchResults() {
      try {
        const res = await fetch(`/api/results/${searchId}`);
        if (!res.ok) {
          throw new Error(
            res.status === 404 ? "Search not found" : "Failed to load results"
          );
        }
        const data = await res.json();
        setResults(data.results || []);
        setSearchParams(data.searchParams || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [searchId]);

  // Sort comparator
  const sortComparator = useCallback(
    (a: FlightResult, b: FlightResult) => {
      let cmp = 0;
      switch (sortField) {
        case "price":
          cmp = a.price - b.price;
          break;
        case "duration":
          cmp = parseDurationMinutes(a.duration) - parseDurationMinutes(b.duration);
          break;
        case "departure": {
          const aTime = new Date(a.departure).getTime() || 0;
          const bTime = new Date(b.departure).getTime() || 0;
          cmp = aTime - bTime;
          break;
        }
      }
      return sortDirection === "asc" ? cmp : -cmp;
    },
    [sortField, sortDirection]
  );

  // Filtered and sorted results
  const displayResults = useMemo(() => {
    let filtered = results;
    if (directOnly) {
      filtered = filtered.filter((r) => r.stops === 0);
    }
    return [...filtered].sort(sortComparator);
  }, [results, directOnly, sortComparator]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-brand-purple" />
          <p className="text-sm font-medium text-slate-500">Loading results...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/")}
          className="text-slate-400 hover:text-white"
        >
          <ArrowLeft className="mr-1 size-4" />
          New Search
        </Button>
        <div className="flex items-center gap-3">
          <Plane className="size-5 text-brand-purple" />
          <h2 className="text-2xl font-black tracking-tight text-white">
            Search Output
          </h2>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
            <span className="font-mono text-[11px] font-bold text-slate-400">
              {displayResults.length} Records Found
            </span>
          </div>
        </div>
      </div>

      {/* Search summary */}
      {searchParams && (
        <div className="mb-6 flex flex-wrap items-center gap-6 rounded-full border border-white/10 bg-white/5 px-6 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Query</span>
            <span className="text-xs font-bold uppercase text-white">
              {searchParams.origin} &rarr; {searchParams.destination}
            </span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Context</span>
            <span className="text-xs font-bold uppercase tracking-tight text-white">
              {searchParams.cabinClass} &bull; {searchParams.departureDate}
            </span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Sort by:
          </label>
          <div className="relative">
            <Select
              value={sortField}
              onValueChange={(v) => setSortField(v as FlightSortField)}
            >
              <SelectTrigger className="w-[180px] rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-white focus:ring-2 focus:ring-brand-purple">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price">Cheapest</SelectItem>
                <SelectItem value="duration">Fastest</SelectItem>
                <SelectItem value="departure">Departure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
            }
            className="border-white/10 bg-white/5 text-xs font-bold uppercase tracking-widest text-white hover:bg-white/10"
          >
            {sortDirection === "asc" ? "↑ Asc" : "↓ Desc"}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={directOnly}
            onCheckedChange={setDirectOnly}
            id="direct-filter"
            className="data-[state=checked]:bg-brand-electric"
          />
          <Label
            htmlFor="direct-filter"
            className="text-sm text-slate-400"
          >
            Direct flights only
          </Label>
        </div>
      </div>

      {/* Results list */}
      {error ? (
        <div className="agent-card flex flex-col items-center gap-3 rounded-2xl py-12 text-red-400">
          <SearchX className="size-8" />
          <p>{error}</p>
        </div>
      ) : displayResults.length === 0 ? (
        <div className="agent-card flex flex-col items-center gap-3 rounded-2xl py-12 text-slate-400">
          <SearchX className="size-8" />
          <p className="text-center font-medium">No flights found</p>
          <p className="text-center text-sm">
            Try adjusting your dates, airports, or removing the
            &quot;direct only&quot; filter.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/")}
            className="mt-2 border-white/10 text-white hover:bg-white/10"
          >
            New Search
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {displayResults.map((flight, i) => (
            <FlightCard key={flight.id} flight={flight} rank={i < 2 ? i + 1 : undefined} />
          ))}
        </div>
      )}

      {/* Search ID */}
      <p className="mt-8 text-center text-[10px] font-bold uppercase tracking-widest text-slate-600">
        Session: {searchId}
      </p>
    </main>
  );
}

/** Parse a duration string like "7h 30m" into minutes */
function parseDurationMinutes(duration: string): number {
  const hours = duration.match(/(\d+)\s*h/)?.[1];
  const minutes = duration.match(/(\d+)\s*m/)?.[1];
  return (parseInt(hours || "0") * 60) + parseInt(minutes || "0");
}
