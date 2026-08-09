import type { CoinEventRow } from "@/lib/supabase/types";
import type { DB } from "./client";

export type CoinSummary = {
  /** いま使えるコイン */
  balance: number;
  /** これまでに獲得したコインの合計 */
  totalEarned: number;
};

export async function getCoinSummary(supabase: DB, userId: string): Promise<CoinSummary> {
  const { data, error } = await supabase
    .from("user_coins")
    .select("balance, total_earned")
    .eq("user_id", userId)
    .maybeSingle();

  // マイグレーション適用前の短い移行時間にもホーム全体を落とさない。
  if (error) {
    console.warn("Coin summary is unavailable", { code: error.code, message: error.message });
  }

  return {
    balance: data?.balance ?? 0,
    totalEarned: data?.total_earned ?? 0,
  };
}

export async function getCoinHistory(supabase: DB, userId: string, limit = 100): Promise<CoinEventRow[]> {
  const { data, error } = await supabase
    .from("coin_events")
    .select("*")
    .eq("user_id", userId)
    .neq("amount", 0)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to load coin history", { code: error.code, message: error.message });
    return [];
  }
  return data ?? [];
}
