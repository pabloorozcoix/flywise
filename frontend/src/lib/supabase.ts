import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://supabase-db:5432";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Database URL for server-side Drizzle ORM connections.
 * Uses Docker service name inside containers, localhost from host.
 */
export const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@supabase-db:5432/postgres";
