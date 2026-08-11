import type { DB } from "./client";
import type { SharedTripListRow } from "@/lib/supabase/types";

const UNAVAILABLE_CODES = new Set(["42P01", "42703", "42883", "PGRST202", "PGRST205"]);

export type SharedTripsSetupStatus = { ready: true; version: number } | { ready: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getSharedTripsSetupStatus(supabase: DB): Promise<SharedTripsSetupStatus> {
  const { data, error } = await supabase.rpc("get_shared_trips_health");
  if (error) {
    if (error.code && UNAVAILABLE_CODES.has(error.code)) return { ready: false };
    console.error("Shared trips health check failed", { code: error.code, message: error.message });
    return { ready: false };
  }
  if (!isRecord(data) || data.ready !== true || typeof data.version !== "number") return { ready: false };
  return { ready: true, version: data.version };
}

export async function getSharedTripList(supabase: DB): Promise<SharedTripListRow[]> {
  const { data, error } = await supabase.rpc("get_shared_trip_list");
  if (error) {
    console.error("Shared trip list failed", { code: error.code, message: error.message });
    return [];
  }
  return data ?? [];
}
