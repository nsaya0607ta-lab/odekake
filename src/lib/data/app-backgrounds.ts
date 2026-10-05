import { cookies } from "next/headers";
import { APP_BACKGROUND_COOKIE, isAppBackgroundId, type AppBackgroundId } from "@/lib/app-backgrounds";
import { HOME_LOOK_COOKIE, normalizeHomeLook, parseHomeLook, type HomeLook } from "@/lib/home-look";
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

/**
 * ホームの着せかえと、DBに保存してある背景（端末をまたいで同じにするため）。
 * - 着せかえは DB を正とする。まだ保存していない・DB の準備（0124）がまだのときは、この端末の Cookie
 * - savedBackground は DB の背景。この端末の Cookie とちがえば、ホームが Cookie を直す（別の端末で変えたとき）
 */
export async function getHomeAppearance(supabase: DB, userId: string): Promise<{ homeLook: HomeLook; savedBackground: AppBackgroundId | null }> {
  const cookieStore = await cookies();
  const fallback = parseHomeLook(cookieStore.get(HOME_LOOK_COOKIE)?.value);
  // 型の定義にまだ無い列なので、ゆるく読む
  const from = supabase.from.bind(supabase) as unknown as (t: string) => {
    select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => PromiseLike<{ data: Record<string, unknown> | null; error: { code?: string; message: string } | null }> } };
  };
  const { data, error } = await from("user_app_background_choice").select("background_id, home_look").eq("user_id", userId).maybeSingle();
  if (error) {
    // 0124 がまだ（home_look 列が無い）なら、背景だけ読みなおす
    if (error.code === "42703") {
      const retry = await from("user_app_background_choice").select("background_id").eq("user_id", userId).maybeSingle();
      return { homeLook: fallback, savedBackground: isAppBackgroundId(retry.data?.background_id) ? retry.data.background_id : null };
    }
    if (!UNAVAILABLE_CODES.has(error.code ?? "")) console.warn("Home appearance is unavailable", { code: error.code, message: error.message });
    return { homeLook: fallback, savedBackground: null };
  }
  return {
    homeLook: data?.home_look ? normalizeHomeLook(data.home_look) : fallback,
    savedBackground: isAppBackgroundId(data?.background_id) ? data.background_id : null,
  };
}
