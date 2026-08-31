import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type DB = SupabaseClient<Database>;

export const PHOTO_BUCKET = "photos";

/** 運営お知らせに添付するHTMLファイル専用のバケット（管理者のみ書き込み可） */
export const NOTICE_HTML_BUCKET = "notice_files";
