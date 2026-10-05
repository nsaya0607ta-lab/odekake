import { cookies } from "next/headers";
import { APP_BACKGROUND_COOKIE, isAppBackgroundId, type AppBackgroundId } from "@/lib/app-backgrounds";
import { HOME_LOOK_COOKIE, parseHomeLook, type HomeLook } from "@/lib/home-look";
import type { DB } from "./client";

const UNAVAILABLE_CODES = new Set(["42P01", "PGRST205"]);

/**
 * 選んでいる背景。Cookieを正として読む（画面遷移のたびにDBへ問い合わせないため）。
 * Cookieが無い利用者は、middleware.ts がDBの選択を一度だけCookieへ焼く。
 */
export async function getCurrentAppBackground(): Promise<AppBackgroundId> {
  const cookieStore = await cookies();
  const value = cookieStore.get(APP_BACKGROUND_COOKIE)?.value;
  return isAppBackgroundId(value) ? value : "default";
}

/** 買った背景（「いつもの」は含まない）。背景ショップの仕組みがまだ無い環境では null */
export async function getOwnedAppBackgrounds(supabase: DB, userId: string): Promise<Set<AppBackgroundId> | null> {
  // 型の定義にまだ無いテーブルなので、ゆるく読む
  const from = supabase.from.bind(supabase) as unknown as (t: string) => {
    select: (c: string) => { eq: (k: string, v: string) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }> };
  };
  const { data, error } = await from("user_app_backgrounds").select("background_id").eq("user_id", userId);
  if (error) {
    if (!UNAVAILABLE_CODES.has(error.code ?? "")) console.warn("App backgrounds are unavailable", { code: error.code, message: error.message });
    return null;
  }
  const owned = new Set<AppBackgroundId>();
  for (const row of data ?? []) {
    if (isAppBackgroundId(row.background_id)) owned.add(row.background_id);
  }
  return owned;
}

/** ホームの着せかえ（カードの並び・出す出さない・透け感）。Cookie から読む */
export async function getHomeLook(): Promise<HomeLook> {
  const cookieStore = await cookies();
  return parseHomeLook(cookieStore.get(HOME_LOOK_COOKIE)?.value);
}
