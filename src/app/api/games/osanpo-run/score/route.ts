import { NextResponse } from "next/server";
import { isOsanpoRunDifficultyId, OSANPO_RUN_STAGE_IDS } from "@/lib/games/osanpo-run/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

/** スコア÷難易度ごとの数（切り上げ）をコインにして配るため、DB側と同じく現実的な範囲に絞る。 */
const MAX_SCORE = 10_000_000;
const MAX_METERS = 1_000_000;
const MAX_ITEMS = 1_000_000;

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
    stage?: unknown;
    difficulty?: unknown;
    score?: unknown;
    meters?: unknown;
    items?: unknown;
  } | null;

  if (
    !body
    || typeof body.roundId !== "string"
    || body.roundId.length < 8
    || body.roundId.length > 90
    || typeof body.stage !== "string"
    || !(OSANPO_RUN_STAGE_IDS as readonly string[]).includes(body.stage)
    || !isCount(body.score, MAX_SCORE)
    || !isCount(body.meters, MAX_METERS)
    || !isCount(body.items, MAX_ITEMS)
    // 難易度ができる前の画面（開いたままのタブ）は、すべての障害物が出る「むずかしい」と同じ内容で遊んでいる
    || (body.difficulty !== undefined && !isOsanpoRunDifficultyId(body.difficulty))
  ) {
    return NextResponse.json({ error: "ゲーム結果が正しくありません。" }, { status: 400 });
  }

  // 1プレイに数十秒はかかる。APIを直接連打して記録やコインを積まれないようにする。
  const limit = checkRateLimit(`osanpo-run:${user.id}`, 40, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: "record_osanpo_run_result",
    args: { p_round_id: string; p_stage: string; p_difficulty: string; p_score: number; p_meters: number; p_items: number },
  ) => Promise<RpcResponse>;

  const { data, error } = await rpc("record_osanpo_run_result", {
    p_round_id: body.roundId,
    p_stage: body.stage,
    p_difficulty: body.difficulty ?? "hard",
    p_score: body.score,
    p_meters: body.meters,
    p_items: body.items,
  });

  if (error) {
    if (error.code && RECORD_UNAVAILABLE_CODES.has(error.code)) {
      return NextResponse.json({ ok: true, ready: false }, { headers: { "Cache-Control": "no-store" } });
    }
    console.error("Failed to record osanpo run score", { code: error.code, message: error.message });
    return NextResponse.json({ error: "スコアを記録できませんでした。" }, { status: 400 });
  }

  const result = toRecord(data);
  return NextResponse.json(
    {
      ok: true,
      ready: true,
      applied: result.applied === true,
      bestScore: typeof result.best_score === "number" ? result.best_score : 0,
      coins: typeof result.coins === "number" ? result.coins : 0,
      balance: typeof result.balance === "number" ? result.balance : 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
