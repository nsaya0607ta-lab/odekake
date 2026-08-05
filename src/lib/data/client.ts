import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type DB = SupabaseClient<Database>;

export const PHOTO_BUCKET = "photos";
