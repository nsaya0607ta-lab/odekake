import { NextResponse } from "next/server";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { DEFAULT_OSANPO_RUN_DIFFICULTY, isOsanpoRunDifficultyId } from "@/lib/games/osanpo-run/config";
import { requireUser } from "@/lib/supabase/server";

type RankingPeriod = "week" | "best";
type RpcError = { code?: string; message?: string } | null;
type RpcResponse = { data: unknown; error: RpcError };

type RankingDbRow = {
  rank_position: number;
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  best_score: number;
  best_meters: number;
  best_stage: string;
  played_at: string;
  is_me: boolean;
};

// マイグレーション未適用（テーブル・関数がまだ無い）ときは、
// エラー画面ではなく「準備中」として静かに扱う。
const RANKING_UNAVAILABLE_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRankingRow(value: unknown): RankingDbRow | null {
  if (!isRecord(value)) return null;

  const rankPosition = Number(value.rank_position);
  const bestScore = Number(value.best_score);
  const bestMeters = Number(value.best_meters);
  if (
    !Number.isInteger(rankPosition)
    || rankPosition < 1
    || typeof value.user_id !== "string"
    || typeof value.display_name !== "string"
    || !Number.isInteger(bestScore)
    || bestScore < 0
    || !Number.isInteger(bestMeters)
    || bestMeters < 0
    || typeof value.best_stage !== "string"
    || typeof value.played_at !== "string"
  ) {
    return null;
  }

  return {
    rank_position: rankPosition,
    user_id: value.user_id,
    display_name: value.display_name,
    profile_image_url: typeof value.profile_image_url === "string" ? value.profile_image_url : null,
    best_score: bestScore,
    best_meters: bestMeters,
    best_stage: value.best_stage,
    played_at: value.played_at,
    is_me: value.is_me === true,
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const periodParam = params.get("period") ?? "week";
  const difficulty = params.get("difficulty") ?? DEFAULT_OSANPO_RUN_DIFFICULTY;
  if (periodParam !== "week" && periodParam !== "best") {
    return NextResponse.json({ error: "ランキング期間が正しくありません。" }, { status: 400 });
  }
  const period: RankingPeriod = periodParam;
  if (!isOsanpoRunDifficultyId(difficulty)) {
    return NextResponse.json({ error: "難易度が正しくありません。" }, { status: 400 });
  }

  const { supabase } = await requireUser();
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: "get_friend_osanpo_run_ranking",
    args: { p_period: RankingPeriod; p_difficulty: string },
  ) => Promise<RpcResponse>;

  const { data, error } = await rpc("get_friend_osanpo_run_ranking", { p_period: period, p_difficulty: difficulty });
  if (error) {
    if (error.code && RANKING_UNAVAILABLE_CODES.has(error.code)) {
      return NextResponse.json({ ready: false, entries: [] }, { headers: { "Cache-Control": "no-store" } });
    }
    console.error("Failed to load osanpo run friend ranking", { code: error.code, message: error.message });
    return NextResponse.json({ error: "ランキングを読み込めませんでした。" }, { status: 500 });
  }

  const rows = Array.isArray(data)
    ? data.map(toRankingRow).filter((row): row is RankingDbRow => row !== null)
    : [];
  const avatarUrls = await signThumbOrOriginalPaths(
    supabase,
    rows.flatMap((row) => (row.profile_image_url ? [row.profile_image_url] : [])),
  );

  return NextResponse.json(
    {
      ready: true,
      period,
      difficulty,
      entries: rows.map((row) => ({
        rank: row.rank_position,
        userId: row.user_id,
        displayName: row.display_name,
        avatarUrl: row.profile_image_url ? avatarUrls.get(row.profile_image_url) ?? null : null,
        score: row.best_score,
        meters: row.best_meters,
        stage: row.best_stage,
        playedAt: row.played_at,
        isMe: row.is_me,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
