"use client";

import { SearchForm } from "@/components/SearchForm";
import { useFlightSearch } from "@/components/SearchForm/hooks/useFlightSearch";

export default function Home() {
  const { submitSearch, isSubmitting, error } = useFlightSearch();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 pt-24 pb-16 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
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
