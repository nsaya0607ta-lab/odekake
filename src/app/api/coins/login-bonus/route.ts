import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

/**
 * ログインボーナスの受け取り。
 *
 * 「1日1回」を決めているのは DB 側（claim_login_bonus の一意キー）で、ここは
 * 呼ぶだけ。何度叩かれても2回目以降は granted:false が返るので、連打しても
 * コインは増えない。
 */

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function POST() {
  const { supabase, user } = await requireUser();

  // 付与そのものはDBが止めるので、ここはむだな呼び出しを間引くだけ。
  const limit = checkRateLimit(`login-bonus:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const { data, error } = await supabase.rpc("claim_login_bonus");

  if (error) {
    console.error("Failed to claim login bonus", { code: error.code, message: error.message });
    return NextResponse.json({ error: "ログインボーナスを受け取れませんでした。" }, { status: 400 });
  }

  const result = toRecord(data);

  return NextResponse.json(
    {
      ok: true,
      granted: result.granted === true,
      amount: typeof result.amount === "number" ? result.amount : 0,
      balance: typeof result.balance === "number" ? result.balance : 0,
      // 端末の時計がずれていても、次に出すかどうかはサーバーが数えた日付で決める
      date: typeof result.date === "string" ? result.date : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
