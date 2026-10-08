import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

/**
 * ホームの犬カードに降ってきたコインを受け取る。ふつう 5 枚・中レア 20 枚・高レア 100 枚（黄色・青・赤どれも同じ）。
 *
 * 1日の回数に上限はない。間かく（8秒）・二重受け取り・レアの回数（直近1時間）は DB（claim_home_coin_drop）が止める。
 * ここはむだな呼び出しを間引くだけ。赤コインは 0135 を当てるまで受け取れないので、そのときは「準備中」と返す
 * （アプリはそれを見て、その画面ではもう赤コインを降らせない）。
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
  const kind = body.kind === "blue" || body.kind === "red" ? body.kind : "coin";
  const tier = body.tier === "epic" || body.tier === "rare" ? body.tier : "common";
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(dropId)) {
    return NextResponse.json({ error: "コインが見つかりませんでした。" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("claim_home_coin_drop", { p_drop_id: dropId, p_kind: kind, p_tier: tier });
  if (error) {
    // 赤コインに対応する前の関数（0135 の前）は 'red' を知らない
    if (kind === "red" && /Invalid coin kind/i.test(error.message)) {
      return NextResponse.json({ ok: true, granted: false, kind, tier, amount: 0, reason: "unavailable" }, { headers: { "Cache-Control": "no-store" } });
    }
    console.error("Failed to claim home coin drop", { code: error.code, message: error.message });
    return NextResponse.json({ error: "コインを受け取れませんでした。" }, { status: 400 });
  }

  const result = toRecord(data);
  return NextResponse.json(
    {
      ok: true,
      granted: result.granted === true,
      kind: result.kind === "blue" || result.kind === "red" ? result.kind : "coin",
      tier: result.tier === "epic" || result.tier === "rare" ? result.tier : "common",
      amount: typeof result.amount === "number" ? result.amount : 0,
      reason: typeof result.reason === "string" ? result.reason : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
