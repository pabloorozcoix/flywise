"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plane,
  ArrowUpDown,
  Loader2,
  SearchX,
} from "lucide-react";

import { FlightCard } from "@/components/FlightCard";
import type { FlightResult, FlightSortField, SortDirection } from "@/lib/types/flightResult";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-zinc-500">Loading results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-8 font-sans dark:bg-black">

      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="mr-1 size-4" />
            New Search
          </Button>
          <div className="flex items-center gap-2">
            <Plane className="size-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              Flight Results
            </h1>
          </div>
        </div>

        {/* Search summary */}
        {searchParams && (
          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 p-3 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {searchParams.origin}
              </span>
              <span>→</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {searchParams.destination}
              </span>
              <span>·</span>
              <span>{searchParams.departureDate}</span>
              {searchParams.returnDate && (
                <>
                  <span>—</span>
                  <span>{searchParams.returnDate}</span>
                </>
              )}
              <span>·</span>
              <span className="capitalize">{searchParams.cabinClass}</span>
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ArrowUpDown className="size-4 text-zinc-400" />
            <Select
              value={sortField}
              onValueChange={(v) => setSortField(v as FlightSortField)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="duration">Duration</SelectItem>
                <SelectItem value="departure">Departure</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
              }
            >
              {sortDirection === "asc" ? "↑ Low to High" : "↓ High to Low"}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={directOnly}
              onCheckedChange={setDirectOnly}
              id="direct-filter"
            />
            <Label htmlFor="direct-filter" className="text-sm">
              Direct flights only
            </Label>
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-zinc-500">
          {displayResults.length} flight{displayResults.length !== 1 ? "s" : ""}{" "}
          found
          {directOnly && results.length !== displayResults.length
            ? ` (${results.length} total)`
            : ""}
        </p>

        {/* Results list */}
        {error ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-red-500">
              <SearchX className="size-8" />
              <p>{error}</p>
            </CardContent>
          </Card>
        ) : displayResults.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-zinc-400">
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
                className="mt-2"
              >
                New Search
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {displayResults.map((flight) => (
              <FlightCard key={flight.id} flight={flight} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Parse a duration string like "7h 30m" into minutes */
function parseDurationMinutes(duration: string): number {
  const hours = duration.match(/(\d+)\s*h/)?.[1];
  const minutes = duration.match(/(\d+)\s*m/)?.[1];
  return (parseInt(hours || "0") * 60) + parseInt(minutes || "0");
}
