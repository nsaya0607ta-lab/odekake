import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

/**
 * ホームの犬カードに降ってきたコインを受け取る（1回 5 枚）。
 *
 * 降るかどうかはアプリ側で決めているので、1日の回数・青の回数・間かく・二重受け取りは
 * すべて DB（claim_home_coin_drop）が止める。ここはむだな呼び出しを間引くだけ。
 */

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();

  const limit = checkRateLimit(`home-drop:${user.id}`, 12, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = toRecord(await request.json().catch(() => null));
  const dropId = typeof body.dropId === "string" ? body.dropId : "";
  const kind = body.kind === "blue" ? "blue" : "coin";
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(dropId)) {
    return NextResponse.json({ error: "コインが見つかりませんでした。" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("claim_home_coin_drop", { p_drop_id: dropId, p_kind: kind });
  if (error) {
    console.error("Failed to claim home coin drop", { code: error.code, message: error.message });
    return NextResponse.json({ error: "コインを受け取れませんでした。" }, { status: 400 });
  }

  const result = toRecord(data);
  return NextResponse.json(
    {
      ok: true,
      granted: result.granted === true,
      kind: result.kind === "blue" ? "blue" : "coin",
      amount: typeof result.amount === "number" ? result.amount : 0,
      remaining: typeof result.remaining === "number" ? result.remaining : null,
      reason: typeof result.reason === "string" ? result.reason : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
