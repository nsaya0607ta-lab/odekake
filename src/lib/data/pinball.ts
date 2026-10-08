import { resolvePinballMapId } from "@/lib/games/pinball/maps";
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

/** ご当地ピンボールの台（マップ）ごとの自分のベスト。前の「県の台」の記録は、同じ形のいつもの台のベストに入れる */
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
    const table = typeof row.table_id === "string" ? resolvePinballMapId(row.table_id) : null;
    const score = Number(row.score);
    if (table && Number.isFinite(score) && !(table in bests)) bests[table] = score;
  }
  return bests;
}
