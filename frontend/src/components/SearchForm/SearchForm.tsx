"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import {
  CalendarIcon,
  Plane,
  MapPin,
  PlaneLanding,
  User,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Key,
} from "lucide-react";

import {
  flightSearchParamsSchema,
  type FlightSearchParams,
} from "@/lib/schemas/flightSearch";
import type { SearchFormProps } from "./types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function SearchForm({
  onSubmit,
  isSubmitting = false,
  defaultValues,
}: SearchFormProps) {
  const form = useForm<FlightSearchParams>({
    resolver: zodResolver(flightSearchParamsSchema),
    defaultValues: {
      origin: "",
      destination: "",
      departureDate: "",
      returnDate: "",
      cabinClass: "economy",
      directOnly: false,
      openaiApiKey: "",
      ...defaultValues,
    },
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = form.handleSubmit(async (data) => {
    /* c8 ignore next -- requires all form fields (including calendar date) valid; jsdom cannot reliably trigger Radix Calendar selection */
    await onSubmit(data);
  });

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8 flex items-center gap-2">
        <Plane className="size-5 text-brand-purple" />
        <h3 className="text-lg font-bold">Search with FlyWise</h3>
      </div>

      <Form {...form}>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Main fields grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {/* Origin */}
            <FormField
              control={form.control}
              name="origin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                    From
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                      <Input
                        placeholder="JFK"
                        {...field}
                        className="rounded-xl border-white/5 bg-near-black py-4 pl-11 pr-4 uppercase text-white placeholder:text-slate-600 focus:border-brand-electric focus:ring-2 focus:ring-brand-electric/50"
                        autoComplete="off"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Destination */}
            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                    To
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <PlaneLanding className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                      <Input
                        placeholder="LHR"
                        {...field}
                        className="rounded-xl border-white/5 bg-near-black py-4 pl-11 pr-4 uppercase text-white placeholder:text-slate-600 focus:border-brand-electric focus:ring-2 focus:ring-brand-electric/50"
                        autoComplete="off"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Departure Date */}
            <FormField
              control={form.control}
              name="departureDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Departure
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full rounded-xl border-white/5 bg-near-black py-4 pl-11 pr-4 text-left font-normal text-white hover:bg-near-black hover:text-white focus:ring-2 focus:ring-brand-electric/50",
                            !field.value && "text-slate-600"
                          )}
                        >
                          <CalendarIcon className="absolute left-4 size-4 text-slate-500" />
                          {field.value
                            ? format(parseISO(field.value), "MMM d, yyyy")
                            : "Pick a date"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          field.value ? parseISO(field.value) : undefined
                        }
                        onSelect={(date) =>
                          field.onChange(
                            /* c8 ignore next -- deselection fallback; Radix Calendar always provides a date in jsdom */
                            date ? format(date, "yyyy-MM-dd") : ""
                          )
                        }
                        disabled={(date) => date < new Date()}
                        autoFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Return Date (optional) */}
            <FormField
              control={form.control}
              name="returnDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Return (optional)
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full rounded-xl border-white/5 bg-near-black py-4 pl-11 pr-4 text-left font-normal text-white hover:bg-near-black hover:text-white focus:ring-2 focus:ring-brand-electric/50",
                            !field.value && "text-slate-600"
                          )}
                        >
                          <CalendarIcon className="absolute left-4 size-4 text-slate-500" />
                          {field.value
                            ? format(parseISO(field.value), "MMM d, yyyy")
                            : "Pick a date"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          field.value ? parseISO(field.value) : undefined
                        }
                        onSelect={(date) =>
                          field.onChange(
                            /* c8 ignore next -- deselection fallback; Radix Calendar always provides a date in jsdom */
                            date ? format(date, "yyyy-MM-dd") : ""
                          )
                        }
                        disabled={(date) => date < new Date()}
                        autoFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cabin Class */}
            <FormField
              control={form.control}
              name="cabinClass"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Class
                  </FormLabel>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-500" />
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full rounded-xl border-white/5 bg-near-black py-4 pl-11 pr-4 text-white focus:ring-2 focus:ring-brand-electric/50">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="economy">Economy</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="first">First Class</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Options row + Submit */}
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex gap-6">
              <FormField
                control={form.control}
                name="directOnly"
                render={({ field }) => (
                  <label className="group flex cursor-pointer items-center gap-3">
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="data-[state=checked]:bg-brand-electric"
                    />
                    <span className="text-sm text-slate-400 transition-colors group-hover:text-white">
                      Direct flights only
                    </span>
                  </label>
                )}
              />
            </div>

            <Button
              type="submit"
              className="gradient-accent glow-effect w-full rounded-xl px-10 py-5 text-base font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] md:w-auto"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 size-4" />
                  Search with FlyWise
                </>
              )}
            </Button>
          </div>

          {/* Advanced — Optional OpenAI API Key */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 px-0 text-slate-500 hover:text-slate-300"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
              Advanced Options
            </Button>
            {showAdvanced && (
              <FormField
                control={form.control}
                name="openaiApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <Key className="size-3.5" />
                      OpenAI API Key (optional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="sk-..."
                        autoComplete="off"
                        className="rounded-xl border-white/5 bg-near-black text-white placeholder:text-slate-600 focus:ring-2 focus:ring-brand-electric/50"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-slate-500">
                      When provided, uses OpenAI gpt-4.1-mini for browser
                      automation instead of local Ollama. The key is not stored.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
