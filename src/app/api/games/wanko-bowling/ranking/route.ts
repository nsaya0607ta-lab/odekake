import { NextResponse } from "next/server";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { canAccessWankoBowling } from "@/lib/games/wanko-bowling-access";
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
  played_at: string;
  is_me: boolean;
};

const RANKING_UNAVAILABLE_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRankingRow(value: unknown): RankingDbRow | null {
  if (!isRecord(value)) return null;

  const rankPosition = Number(value.rank_position);
  const bestScore = Number(value.best_score);
  if (
    !Number.isInteger(rankPosition)
    || rankPosition < 1
    || typeof value.user_id !== "string"
    || typeof value.display_name !== "string"
    || !Number.isInteger(bestScore)
    || bestScore < 0
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
    played_at: value.played_at,
    is_me: value.is_me === true,
  };
}

export async function GET(request: Request) {
  const periodParam = new URL(request.url).searchParams.get("period") ?? "week";
  if (periodParam !== "week" && periodParam !== "best") {
    return NextResponse.json({ error: "ランキング期間が正しくありません。" }, { status: 400 });
  }
  const period: RankingPeriod = periodParam;

  const { supabase, user } = await requireUser();
  // 実験中のため、許可アカウント以外は存在ごと知られないよう404で返す。
  if (!canAccessWankoBowling(user.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: "get_friend_wanko_bowling_ranking",
    args: { p_period: RankingPeriod },
  ) => Promise<RpcResponse>;

  const { data, error } = await rpc("get_friend_wanko_bowling_ranking", { p_period: period });
  if (error) {
    if (error.code && RANKING_UNAVAILABLE_CODES.has(error.code)) {
      return NextResponse.json(
        { ready: false, entries: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    console.error("Failed to load wanko bowling friend ranking", {
      code: error.code,
      message: error.message,
    });
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
      entries: rows.map((row) => ({
        rank: row.rank_position,
        userId: row.user_id,
        displayName: row.display_name,
        avatarUrl: row.profile_image_url ? avatarUrls.get(row.profile_image_url) ?? null : null,
        score: row.best_score,
        playedAt: row.played_at,
        isMe: row.is_me,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
