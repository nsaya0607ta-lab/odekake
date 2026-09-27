import { NextResponse } from "next/server";
import { getOsanpoRunCostume } from "@/lib/games/osanpo-run/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = { data: unknown; error: { code?: string; message: string } | null };

/** テーブル・関数がまだ無い環境では「準備中」として返す */
const UNAVAILABLE_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** きせかえをコインで買う。値段はサーバー側（DB関数）で決める */
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  const body = (await request.json().catch(() => null)) as { costumeId?: unknown } | null;
  const costume = typeof body?.costumeId === "string" ? getOsanpoRunCostume(body.costumeId) : null;
  if (!costume) {
    return NextResponse.json({ error: "そのきせかえは見つかりません。" }, { status: 400 });
  }

  const limit = checkRateLimit(`osanpo-run-costume:${user.id}`, 30, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: "buy_osanpo_run_costume",
    args: { p_costume_id: string },
  ) => Promise<RpcResponse>;
  const { data, error } = await rpc("buy_osanpo_run_costume", { p_costume_id: costume.id });

  if (error) {
    if (error.code && UNAVAILABLE_CODES.has(error.code)) {
      return NextResponse.json({ ok: false, ready: false, error: "きせかえは準備中です。" }, { status: 503 });
    }
    console.error("Failed to buy osanpo run costume", { code: error.code, message: error.message });
    return NextResponse.json({ error: "買えませんでした。" }, { status: 400 });
  }

  const result = toRecord(data);
  const balance = typeof result.balance === "number" ? result.balance : 0;
  if (result.ok !== true) {
    return NextResponse.json(
      { ok: false, reason: result.reason ?? "unknown", balance, error: "コインが足りません。" },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { ok: true, applied: result.applied === true, balance, costumeId: costume.id },
    { headers: { "Cache-Control": "no-store" } },
  );
}
