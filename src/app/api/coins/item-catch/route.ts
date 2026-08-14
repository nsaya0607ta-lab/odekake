import { NextResponse } from "next/server";
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
    caughtCount?: unknown;
    durationSeconds?: unknown;
  } | null;

  if (
    !body
    || typeof body.roundId !== "string"
    || body.roundId.length < 8
    || body.roundId.length > 100
    || typeof body.score !== "number"
    || !Number.isInteger(body.score)
    || typeof body.caughtCount !== "number"
    || !Number.isInteger(body.caughtCount)
    || typeof body.durationSeconds !== "number"
    || !Number.isInteger(body.durationSeconds)
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

  const rpc = supabase.rpc as unknown as (
    fn: "record_item_catch_result",
    args: { p_round_id: string; p_score: number; p_caught_count: number; p_duration_seconds: number },
  ) => Promise<RpcResponse>;

  const { data, error } = await rpc("record_item_catch_result", {
    p_round_id: body.roundId,
    p_score: body.score,
    p_caught_count: body.caughtCount,
    p_duration_seconds: body.durationSeconds,
  });

  if (error) {
    console.error("Failed to record item catch reward", { code: error.code, message: error.message });
    return NextResponse.json({ error: "コインを受け取れませんでした。" }, { status: 400 });
  }

  const result = toRecord(data);
  return NextResponse.json(
    {
      ok: result.ok === true,
      applied: result.applied === true,
      coins: typeof result.coins === "number" ? result.coins : 0,
      balance: typeof result.balance === "number" ? result.balance : 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
