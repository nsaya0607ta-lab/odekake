import type { DB } from "./client";

const UNAVAILABLE_CODES = new Set(["42P01", "PGRST205"]);

/** 青コインの残高。青コインの仕組みがまだ無い環境では null（表示しない） */
export async function getBlueCoinBalance(supabase: DB, userId: string): Promise<number | null> {
  // 型の定義にまだ無いテーブルなので、ゆるく読む
  const from = supabase.from.bind(supabase) as unknown as (t: string) => {
    select: (c: string) => { eq: (k: string, v: string) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }> };
  };
  const { data, error } = await from("user_blue_coins").select("balance").eq("user_id", userId);
  if (error) {
    if (!UNAVAILABLE_CODES.has(error.code ?? "")) console.warn("Blue coins are unavailable", { code: error.code, message: error.message });
    return null;
  }
  const balance = data?.[0]?.balance;
  return typeof balance === "number" ? balance : 0;
}
