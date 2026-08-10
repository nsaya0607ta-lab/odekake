import { getStepCoins } from "@/lib/coins";
import { todayInJapan } from "@/lib/date";
import type { CoinEventRow } from "@/lib/supabase/types";
import type { DB } from "./client";

export type CoinSummary = {
  /** いま使えるコイン */
  balance: number;
  /** これまでに獲得したコインの合計 */
  totalEarned: number;
};

export type StepCoinSyncResult = {
  expectedCoins: number;
  actualCoins: number | null;
  repaired: boolean;
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

/**
 * 今日の歩数に対応するコイン台帳が欠けていたり古い場合だけ、既存の歩数RPCを
 * もう一度呼んで自己修復する。RPC側は steps:{日付} の同じ台帳行を更新するため、
 * 二重付与にはならない。
 */
export async function ensureTodayStepCoins(
  supabase: DB,
  userId: string,
  steps: number | null,
): Promise<StepCoinSyncResult> {
  const expectedCoins = getStepCoins(steps);
  if (steps === null) return { expectedCoins, actualCoins: 0, repaired: false };

  const today = todayInJapan();
  const idempotencyKey = `steps:${today}`;
  const { data: event, error: eventError } = await supabase
    .from("coin_events")
    .select("amount")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (eventError) {
    console.warn("Step coin event is unavailable", {
      code: eventError.code,
      message: eventError.message,
      idempotencyKey,
    });
    return { expectedCoins, actualCoins: null, repaired: false };
  }

  const actualCoins = event?.amount ?? 0;
  if (actualCoins === expectedCoins) {
    return { expectedCoins, actualCoins, repaired: false };
  }

  const { error: syncError } = await supabase.rpc("record_daily_steps", {
    p_step_date: today,
    p_steps: steps,
  });

  if (syncError) {
    console.error("Failed to repair step coins", {
      code: syncError.code,
      message: syncError.message,
      expectedCoins,
      actualCoins,
    });
    return { expectedCoins, actualCoins, repaired: false };
  }

  return { expectedCoins, actualCoins: expectedCoins, repaired: true };
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
