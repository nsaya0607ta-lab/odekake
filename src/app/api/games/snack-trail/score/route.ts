import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

/** スコアの2/3をコインとして配るため、偽装スコアで稼がれないよう現実的な範囲に絞っている。 */
const MAX_SCORE = 5_000;
const MAX_COMBO = 5_000;
const MAX_COLLECTED = 100_000;

/** テーブル・関数がまだ無い環境では、記録できないことをエラーにしない。 */
const RECORD_UNAVAILABLE_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function isCount(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();

  const body = (await request.json().catch(() => null)) as {
    roundId?: unknown;
    score?: unknown;
    maxCombo?: unknown;
    collected?: unknown;
  } | null;

  if (
    !body
    || typeof body.roundId !== "string"
    || body.roundId.length < 8
    || body.roundId.length > 90
    || !isCount(body.score, MAX_SCORE)
    || !isCount(body.maxCombo, MAX_COMBO)
    || !isCount(body.collected, MAX_COLLECTED)
  ) {
    return NextResponse.json({ error: "ゲーム結果が正しくありません。" }, { status: 400 });
  }

  // 1プレイに数十秒はかかる。APIを直接連打して記録を積まれないようにする。
  const limit = checkRateLimit(`snack-trail:${user.id}`, 40, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: "record_snack_trail_result",
    args: {
      p_round_id: string;
      p_score: number;
      p_max_combo: number;
      p_collected: number;
    },
  ) => Promise<RpcResponse>;

  const { data, error } = await rpc("record_snack_trail_result", {
    p_round_id: body.roundId,
    p_score: body.score,
    p_max_combo: body.maxCombo,
    p_collected: body.collected,
  });

  if (error) {
    if (error.code && RECORD_UNAVAILABLE_CODES.has(error.code)) {
      return NextResponse.json({ ok: true, ready: false }, { headers: { "Cache-Control": "no-store" } });
    }
    console.error("Failed to record snack trail score", { code: error.code, message: error.message });
    return NextResponse.json({ error: "スコアを記録できませんでした。" }, { status: 400 });
  }

  const result = toRecord(data);
  return NextResponse.json(
    {
      ok: true,
      ready: true,
      applied: result.applied === true,
      bestScore: typeof result.best_score === "number" ? result.best_score : 0,
      bestCombo: typeof result.best_combo === "number" ? result.best_combo : 0,
      coins: typeof result.coins === "number" ? result.coins : 0,
      balance: typeof result.balance === "number" ? result.balance : 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
