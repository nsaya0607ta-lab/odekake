import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = { data: unknown; error: { code?: string; message: string } | null };

/** テーブル・関数がまだ無い環境では「準備中」として静かに扱う */
const UNAVAILABLE_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

type Rpc = (fn: "get_osanpo_run_coop" | "claim_osanpo_run_coop") => Promise<RpcResponse>;

/** 協力チャレンジの今週の進み具合（自分＋フレンド） */
export async function GET() {
  const { supabase } = await requireUser();
  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
  const { data, error } = await rpc("get_osanpo_run_coop");
  if (error) {
    if (error.code && UNAVAILABLE_CODES.has(error.code)) return NextResponse.json({ ready: false }, { headers: { "Cache-Control": "no-store" } });
    console.error("Failed to load osanpo run coop", { code: error.code, message: error.message });
    return NextResponse.json({ error: "協力チャレンジを読み込めませんでした。" }, { status: 500 });
  }
  const r = toRecord(data);
  const members = Array.isArray(r.members)
    ? r.members.map(toRecord).map((m) => ({
        userId: String(m.user_id ?? ""),
        displayName: typeof m.display_name === "string" ? m.display_name : "ゲスト",
        meters: num(m.meters),
        isMe: m.is_me === true,
      }))
    : [];
  return NextResponse.json(
    { ready: true, goal: num(r.goal), total: num(r.total), claimed: r.claimed === true, coins: num(r.coins), members },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** 目標を達成していれば、今週ぶんのコインを受け取る */
export async function POST() {
  const { supabase, user } = await requireUser();
  const limit = checkRateLimit(`osanpo-run-coop:${user.id}`, 10, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "すこし時間をおいてからお試しください。" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
  const { data, error } = await rpc("claim_osanpo_run_coop");
  if (error) {
    if (error.message === "COOP_NOT_REACHED") return NextResponse.json({ error: "まだ目標に届いていません。" }, { status: 400 });
    if (error.code && UNAVAILABLE_CODES.has(error.code)) return NextResponse.json({ ready: false }, { headers: { "Cache-Control": "no-store" } });
    console.error("Failed to claim osanpo run coop", { code: error.code, message: error.message });
    return NextResponse.json({ error: "受け取れませんでした。" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, coins: num(toRecord(data).coins) }, { headers: { "Cache-Control": "no-store" } });
}
