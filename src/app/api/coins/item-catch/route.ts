import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

const MAX_CAUGHT_COUNT = 150;
const MAX_SCORE_PER_CATCH = 800;
const MAX_SCORE_PER_RPC = 8000;

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function splitScoreForLegacyValidation(score: number): number[] {
  if (score <= MAX_SCORE_PER_RPC) return [score];

  const chunks: number[] = [];
  let remaining = score;
  while (remaining > MAX_SCORE_PER_RPC) {
    let chunk = MAX_SCORE_PER_RPC;
    const remainder = remaining - chunk;
    if (remainder > 0 && remainder < 25) chunk -= 25 - remainder;
    chunks.push(chunk);
    remaining -= chunk;
  }
  if (remaining > 0) chunks.push(remaining);
  return chunks;
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  const body = (await request.json().catch(() => null)) as {
    roundId?: unknown;
    score?: unknown;
    caughtCount?: unknown;
    durationSeconds?: unknown;
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
  ) {
    return NextResponse.json({ error: "ゲーム結果が正しくありません。" }, { status: 400 });
  }

  if (
    body.durationSeconds !== 30
    || body.score < 0
    || body.caughtCount < 0
    || body.caughtCount > MAX_CAUGHT_COUNT
    || (body.caughtCount === 0 && body.score !== 0)
    || (body.caughtCount > 0 && body.score > body.caughtCount * MAX_SCORE_PER_CATCH)
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
    args: { p_round_id: string; p_score: number; p_caught_count: number; p_duration_seconds: number },
  ) => Promise<RpcResponse>;

  const scoreChunks = splitScoreForLegacyValidation(body.score);
  let totalCoins = 0;
  let latestBalance = 0;
  let anyApplied = false;

  for (let index = 0; index < scoreChunks.length; index += 1) {
    const scoreChunk = scoreChunks[index]!;
    const rpcRoundId = scoreChunks.length === 1 ? body.roundId : `${body.roundId}:${index + 1}`;
    const legacyCaughtCount = scoreChunk === 0
      ? 0
      : scoreChunks.length === 1
        ? Math.max(body.caughtCount, Math.ceil(scoreChunk / 100))
        : Math.ceil(scoreChunk / 100);

    const { data, error } = await rpc("record_item_catch_result", {
      p_round_id: rpcRoundId,
      p_score: scoreChunk,
      p_caught_count: legacyCaughtCount,
      p_duration_seconds: body.durationSeconds,
    });

    if (error) {
      console.error("Failed to record item catch reward", { code: error.code, message: error.message });
      return NextResponse.json({ error: "コインを受け取れませんでした。" }, { status: 400 });
    }

    const result = toRecord(data);
    if (result.applied === true) anyApplied = true;
    if (typeof result.coins === "number") totalCoins += result.coins;
    if (typeof result.balance === "number") latestBalance = result.balance;
  }

  return NextResponse.json(
    {
      ok: true,
      applied: anyApplied,
      coins: totalCoins,
      balance: latestBalance,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
