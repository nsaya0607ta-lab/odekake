import { NextResponse } from "next/server";
import {
  BOWLING_FRAME_COUNT,
  calculateBowlingScore,
  countGoldenPinHits,
  isValidBowlingPinFalls,
  isValidCompletedBowlingFrames,
  type BowlingFrame,
  type BowlingPinFalls,
} from "@/lib/games/wanko-bowling-score";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();

  const body = (await request.json().catch(() => null)) as {
    roundId?: unknown;
    frames?: unknown;
    pinFalls?: unknown;
  } | null;

  if (
    !body
    || typeof body.roundId !== "string"
    || body.roundId.length < 8
    || body.roundId.length > 90
    || !isValidCompletedBowlingFrames(body.frames)
  ) {
    return NextResponse.json({ error: "ゲーム結果が正しくありません。" }, { status: 400 });
  }

  // 合計点やストライク等の回数、ゴールデンピン成功数はクライアント値を信用しない。
  // 合法な投球列とピン番号を検証し、同じ純粋関数でサーバー側から再計算する。
  const frames = body.frames as BowlingFrame[];
  if (!isValidBowlingPinFalls(frames, body.pinFalls)) {
    return NextResponse.json({ error: "ゲーム結果が正しくありません。" }, { status: 400 });
  }
  const pinFalls = body.pinFalls as BowlingPinFalls;
  const finalState = calculateBowlingScore(frames);
  if (!finalState.isComplete) {
    return NextResponse.json({ error: "ゲーム結果が正しくありません。" }, { status: 400 });
  }

  const goldenHits = countGoldenPinHits(body.roundId, pinFalls);

  // 1ゲーム数十秒〜数分を想定。直接APIを連打してコインを稼ぐ被害も抑える。
  const limit = checkRateLimit(`wanko-bowling:${user.id}`, 30, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: "record_wanko_bowling_result",
    args: {
      p_round_id: string;
      p_score: number;
      p_strike_count: number;
      p_spare_count: number;
      p_gutter_count: number;
      p_frame_count: number;
      p_golden_hits: number;
    },
  ) => Promise<RpcResponse>;

  const { data, error } = await rpc("record_wanko_bowling_result", {
    p_round_id: body.roundId,
    p_score: finalState.total,
    p_strike_count: finalState.strikeCount,
    p_spare_count: finalState.spareCount,
    p_gutter_count: finalState.gutterCount,
    p_frame_count: BOWLING_FRAME_COUNT,
    p_golden_hits: goldenHits,
  });

  if (error) {
    console.error("Failed to record wanko bowling reward", { code: error.code, message: error.message });
    return NextResponse.json({ error: "コインを受け取れませんでした。" }, { status: 400 });
  }

  const result = toRecord(data);
  return NextResponse.json(
    {
      ok: true,
      applied: result.applied === true,
      score: finalState.total,
      goldenHits,
      goldenBonusCoins: goldenHits * 10,
      coins: typeof result.coins === "number" ? result.coins : 0,
      balance: typeof result.balance === "number" ? result.balance : 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
