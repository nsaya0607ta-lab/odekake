import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

const MAX_CAUGHT_COUNT = 10000;
/** 1ラウンドで申告できるスコアの上限（100億）。ゲームを介さずAPIを直接叩いて
 *  荒唐無稽なスコアを送るのを防ぐ。record_item_catch_result()側の上限と揃えている。 */
const MAX_TOTAL_SCORE = 10_000_000_000;
/** ゲームを介さずAPIを直接叩いて無限にコインを増やせてしまわないための固定上限。
 *  record_item_catch_result() 側の上限(10000)と揃えている。 */
const MAX_BONUS_COINS = 10000;

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  const body = (await request.json().catch(() => null)) as {
    roundId?: unknown;
    score?: unknown;
    caughtCount?: unknown;
    durationSeconds?: unknown;
    bonusCoins?: unknown;
  } | null;

  if (
    !body
    || typeof body.roundId !== "string"
    || body.roundId.length < 8
    || body.roundId.length > 90
    || typeof body.score !== "number"
    || !Number.isInteger(body.score)
    || typeof body.caughtCount !== "number"
    || !Number.isInteger(body.caughtCount)
    || typeof body.durationSeconds !== "number"
    || !Number.isInteger(body.durationSeconds)
    || (body.bonusCoins !== undefined && (typeof body.bonusCoins !== "number" || !Number.isInteger(body.bonusCoins)))
  ) {
    return NextResponse.json({ error: "ゲーム結果が正しくありません。" }, { status: 400 });
  }

  const bonusCoins = body.bonusCoins ?? 0;

  // ゲーム内の得点倍率スキルはスタック上限を設けない仕様（docs/minigame-time-balance.md参照）で、
  // 1回のキャッチで数十万倍以上の倍率がかかることもあるため、キャッチ数に対するスコア上限（1回あたり
  // 固定pt）でのチェックは行わない。
  if (
    body.durationSeconds !== 50
    || body.score < 0
    || body.score > MAX_TOTAL_SCORE
    || body.caughtCount < 0
    || body.caughtCount > MAX_CAUGHT_COUNT
    || (body.caughtCount === 0 && body.score !== 0)
    || bonusCoins < 0
    || bonusCoins > MAX_BONUS_COINS
  ) {
    return NextResponse.json({ error: "ゲーム結果が正しくありません。" }, { status: 400 });
  }

  const limit = checkRateLimit(`item-catch:${user.id}`, 150, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: "record_item_catch_result",
    args: { p_round_id: string; p_score: number; p_caught_count: number; p_duration_seconds: number; p_bonus_coins: number },
  ) => Promise<RpcResponse>;

  // record_item_catch_result()側のスコア比率チェックを撤廃した(0093マイグレーション)ため、
  // 高スコアでもチャンク分割せず1回のRPC呼び出しで完結する。
  const { data, error } = await rpc("record_item_catch_result", {
    p_round_id: body.roundId,
    p_score: body.score,
    p_caught_count: body.caughtCount,
    p_duration_seconds: body.durationSeconds,
    p_bonus_coins: bonusCoins,
  });

  if (error) {
    console.error("Failed to record item catch reward", { code: error.code, message: error.message });
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
