"use client";

import { Plane } from "lucide-react";
import { SearchForm } from "@/components/SearchForm";
import { useFlightSearch } from "@/components/SearchForm/hooks/useFlightSearch";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  const { submitSearch, isSubmitting, error } = useFlightSearch();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-16 font-sans dark:bg-black">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <main className="flex w-full max-w-2xl flex-col items-center gap-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-3">
            <Plane className="size-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
              AeroAgent AI
            </h1>
          </div>
          <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
            AI-powered flight search using local LLM and browser automation.
            Enter your travel details below to get started.
          </p>
        </div>

        {/* Search Form */}
        <SearchForm onSubmit={submitSearch} isSubmitting={isSubmitting} />

        {/* Error Display */}
        {error && (
          <div className="w-full max-w-2xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
