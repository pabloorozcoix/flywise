"use client";

import { format } from "date-fns";
import { Plane, Clock, ArrowRight, ExternalLink, ShieldCheck, ShieldAlert } from "lucide-react";
import type { FlightCardProps } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function FlightCard({ flight }: FlightCardProps) {
  const formattedDeparture = safeFormatTime(flight.departure);
  const formattedArrival = safeFormatTime(flight.arrival);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Airline info */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Plane className="size-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              {flight.airline}
            </p>
            {flight.stops === 0 ? (
              <Badge
                variant="secondary"
                className="mt-1 text-xs text-green-700 dark:text-green-400"
              >
                Non-stop
              </Badge>
            ) : (
              <Badge variant="secondary" className="mt-1 text-xs">
                {flight.stops} stop{flight.stops > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>

        {/* Times */}
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formattedDeparture}
            </p>
            {flight.origin && (
              <p className="text-xs text-zinc-500">{flight.origin}</p>
            )}
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <ArrowRight className="size-4 text-zinc-400" />
            <div className="flex items-center gap-1 text-xs text-zinc-400">
              <Clock className="size-3" />
              <span>{flight.duration}</span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formattedArrival}
            </p>
            {flight.destination && (
              <p className="text-xs text-zinc-500">{flight.destination}</p>
            )}
          </div>
        </div>

        {/* Price & action */}
        <div className="flex flex-col items-end gap-2">
          <p className="text-2xl font-bold text-primary">
            {flight.currency === "USD" ? "$" : flight.currency}{" "}
            {flight.price.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </p>

          {/* Verification badge */}
          {flight.verified ? (
            <Badge
              variant="secondary"
              className="text-xs text-green-700 dark:text-green-400"
            >
              <ShieldCheck className="mr-1 size-3" />
              Verified
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-xs text-zinc-500 dark:text-zinc-400"
            >
              <ShieldAlert className="mr-1 size-3" />
              Unverified
            </Badge>
          )}

          {flight.url && (
            <Button variant="outline" size="sm" asChild>
              <a href={flight.url} target="_blank" rel="noopener noreferrer">
                Book
                <ExternalLink className="ml-1 size-3" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Safely format a time string — handles ISO dates and plain time strings */
function safeFormatTime(value: string): string {
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return format(date, "HH:mm");
    }
  } catch {
    // fallthrough
  }
  return value;
}
