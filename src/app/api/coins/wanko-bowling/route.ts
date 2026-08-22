import { NextResponse } from "next/server";
import { BOWLING_PERFECT_SCORE, BOWLING_FRAME_COUNT } from "@/lib/games/wanko-bowling-score";
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
    score?: unknown;
    strikeCount?: unknown;
    spareCount?: unknown;
    gutterCount?: unknown;
    frameCount?: unknown;
  } | null;

  if (
    !body
    || typeof body.roundId !== "string"
    || body.roundId.length < 8
    || body.roundId.length > 90
    || typeof body.score !== "number"
    || !Number.isInteger(body.score)
    || typeof body.strikeCount !== "number"
    || !Number.isInteger(body.strikeCount)
    || typeof body.spareCount !== "number"
    || !Number.isInteger(body.spareCount)
    || typeof body.gutterCount !== "number"
    || !Number.isInteger(body.gutterCount)
    || typeof body.frameCount !== "number"
    || !Number.isInteger(body.frameCount)
  ) {
    return NextResponse.json({ error: "ゲーム結果が正しくありません。" }, { status: 400 });
  }

  if (
    body.frameCount !== BOWLING_FRAME_COUNT
    || body.score < 0
    || body.score > BOWLING_PERFECT_SCORE
    || body.strikeCount < 0
    || body.strikeCount > 7
    || body.spareCount < 0
    || body.spareCount > BOWLING_FRAME_COUNT
    || body.gutterCount < 0
    || body.gutterCount > BOWLING_FRAME_COUNT * 3
  ) {
    return NextResponse.json({ error: "ゲーム結果が正しくありません。" }, { status: 400 });
  }

  const limit = checkRateLimit(`wanko-bowling:${user.id}`, 150, 60 * 60_000);
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
    },
  ) => Promise<RpcResponse>;

  const { data, error } = await rpc("record_wanko_bowling_result", {
    p_round_id: body.roundId,
    p_score: body.score,
    p_strike_count: body.strikeCount,
    p_spare_count: body.spareCount,
    p_gutter_count: body.gutterCount,
    p_frame_count: body.frameCount,
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
      coins: typeof result.coins === "number" ? result.coins : 0,
      balance: typeof result.balance === "number" ? result.balance : 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
