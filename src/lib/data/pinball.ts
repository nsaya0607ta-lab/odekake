import { resolvePinballMapId } from "@/lib/games/pinball/maps";
import { parseStageSpec, validateStage, type StageSpec } from "@/lib/games/pinball/stage";
import type { DB } from "./client";
import { signThumbOrOriginalPaths } from "./photos";

const UNAVAILABLE_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

type DbError = { code?: string; message: string };
type Rows = { data: Record<string, unknown>[] | null; error: DbError | null };

type LooseFrom = (t: string) => {
  select: (c: string) => {
    eq: (k: string, v: string) => PromiseLike<Rows> & {
      order: (col: string, opts: { ascending: boolean }) => {
        limit: (n: number) => PromiseLike<Rows>;
      };
    };
  };
};

// 型の定義にまだ無いテーブル・関数（0134・0138）なので、ゆるく読む
function loose(supabase: DB): LooseFrom {
  return supabase.from.bind(supabase) as unknown as LooseFrom;
}

function looseRpc(supabase: DB) {
  return supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: DbError | null }>;
}

/** ご当地ピンボールの台（マップ）ごとの自分のベスト。前の「県の台」の記録は、同じ形のいつもの台のベストに入れる（ステージの記録は入れない） */
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

/** 自分で買った部品の数（はじめから持っているぶんは入らない）。部品の仕組みがまだ無い環境では null */
export async function getPinballBoughtParts(supabase: DB, userId: string): Promise<Record<string, number> | null> {
  const { data, error } = await loose(supabase)("user_pinball_parts").select("part,count").eq("user_id", userId);
  if (error) {
    if (!UNAVAILABLE_CODES.has(error.code ?? "")) console.warn("Pinball parts are unavailable", { code: error.code, message: error.message });
    return null;
  }
  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const count = Number(row.count);
    if (typeof row.part === "string" && Number.isFinite(count)) out[row.part] = count;
  }
  return out;
}

export type PinballStageInfo = {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  name: string;
  /** 読めないデータのときは null */
  spec: StageSpec | null;
  /** 置き方に問題が無いか（validateStage。部品の数は見ない）。問題があるステージはフレンドには出さない */
  valid: boolean;
  shared: boolean;
  updatedAt: string;
  isMine: boolean;
  /** 置き方を最後に変えてからの、自分のベスト */
  myBest: number | null;
  /** 置き方を最後に変えてからの、自分とフレンドの中のいちばん */
  topScore: number | null;
  topName: string | null;
  /** 作った人のほかに遊ばれた回数 */
  plays: number;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** 自分のステージと、フレンドが公開したステージ（自分のものが先・新しい順）。ステージの仕組みがまだ無い環境では null */
export async function getPinballStages(supabase: DB): Promise<PinballStageInfo[] | null> {
  const { data, error } = await looseRpc(supabase)("get_pinball_stages");
  if (error) {
    if (!UNAVAILABLE_CODES.has(error.code ?? "")) console.warn("Pinball stages are unavailable", { code: error.code, message: error.message });
    return null;
  }
  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const avatars = await signThumbOrOriginalPaths(
    supabase,
    rows.flatMap((row) => (typeof row.owner_image_url === "string" ? [row.owner_image_url] : [])),
  );
  return rows.flatMap((row): PinballStageInfo[] => {
    if (typeof row.id !== "string" || typeof row.user_id !== "string" || typeof row.name !== "string") return [];
    const spec = parseStageSpec(row.spec);
    return [
      {
        id: row.id,
        ownerId: row.user_id,
        ownerName: typeof row.owner_name === "string" ? row.owner_name : "フレンド",
        ownerAvatarUrl: typeof row.owner_image_url === "string" ? avatars.get(row.owner_image_url) ?? null : null,
        name: row.name,
        spec,
        valid: spec !== null && validateStage(spec).length === 0,
        shared: row.shared === true,
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
        isMine: row.is_mine === true,
        myBest: num(row.my_best),
        topScore: num(row.top_score),
        topName: typeof row.top_name === "string" ? row.top_name : null,
        plays: num(row.plays) ?? 0,
      },
    ];
  });
}
