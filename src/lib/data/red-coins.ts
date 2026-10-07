import type { DB } from "./client";

const UNAVAILABLE_CODES = new Set(["42P01", "PGRST205"]);

type LooseFrom = (t: string) => {
  select: (c: string) => {
    eq: (k: string, v: string) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }> & {
      order: (col: string, opts: { ascending: boolean }) => {
        limit: (n: number) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }>;
      };
    };
  };
};

// 型の定義にまだ無いテーブル（0134）なので、ゆるく読む
function loose(supabase: DB): LooseFrom {
  return supabase.from.bind(supabase) as unknown as LooseFrom;
}

/** 赤コインの残高。赤コインの仕組みがまだ無い環境では null（表示しない） */
export async function getRedCoinBalance(supabase: DB, userId: string): Promise<number | null> {
  const { data, error } = await loose(supabase)("user_red_coins").select("balance").eq("user_id", userId);
  if (error) {
    if (!UNAVAILABLE_CODES.has(error.code ?? "")) console.warn("Red coins are unavailable", { code: error.code, message: error.message });
    return null;
  }
  const balance = data?.[0]?.balance;
  return typeof balance === "number" ? balance : 0;
}

export type RedCoinEvent = { id: number; amount: number; label: string; createdAt: string; score: number | null; table: string | null };

/** 赤コインの履歴（新しい順） */
export async function getRedCoinEvents(supabase: DB, userId: string, limit = 20): Promise<RedCoinEvent[] | null> {
  const { data, error } = await loose(supabase)("red_coin_events")
    .select("id,amount,metadata,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (!UNAVAILABLE_CODES.has(error.code ?? "")) console.warn("Red coin history is unavailable", { code: error.code, message: error.message });
    return null;
  }
  return (data ?? []).map((row) => {
    const meta = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
    return {
      id: Number(row.id),
      amount: Number(row.amount) || 0,
      label: typeof meta.label === "string" ? meta.label : "赤コイン",
      createdAt: typeof row.created_at === "string" ? row.created_at : "",
      score: typeof meta.score === "number" ? meta.score : null,
      table: typeof meta.table === "string" ? meta.table : null,
    };
  });
}

/** ご当地ピンボールの台ごとの自分のベスト */
export async function getPinballBests(supabase: DB, userId: string): Promise<Record<string, number>> {
  const { data, error } = await loose(supabase)("pinball_scores")
    .select("table_id,score")
    .eq("user_id", userId)
    .order("score", { ascending: false })
    .limit(500);
  if (error) {
    if (!UNAVAILABLE_CODES.has(error.code ?? "")) console.warn("Pinball scores are unavailable", { code: error.code, message: error.message });
    return {};
  }
  const bests: Record<string, number> = {};
  for (const row of data ?? []) {
    const table = typeof row.table_id === "string" ? row.table_id : null;
    const score = Number(row.score);
    if (table && Number.isFinite(score) && !(table in bests)) bests[table] = score;
  }
  return bests;
}
