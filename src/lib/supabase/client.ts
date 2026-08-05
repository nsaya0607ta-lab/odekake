"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";
import type { Database } from "./types";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (cached) return cached;
  const { url, anonKey } = requireSupabaseEnv();
  cached = createBrowserClient<Database>(url, anonKey);
  return cached;
}
