import { NextResponse } from "next/server";
import { todayInJapan } from "@/lib/date";
import { getDailyMissions } from "@/lib/games/osanpo-run/missions";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

type RpcResponse = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

/** テーブル・関数がまだ無い環境では、記録できないことをエラーにしない。 */
const RECORD_UNAVAILABLE_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** 今日のミッションを1つ達成として記録し、コインを受け取る */
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();

  const body = (await request.json().catch(() => null)) as { missionId?: unknown } | null;
  const missionId = body?.missionId;
  // 今日のお題かどうかはここで確かめる（日付をまたいで遊んでいた場合も、前日のお題は受け付けない）
  if (typeof missionId !== "string" || !getDailyMissions(todayInJapan()).some((m) => m.id === missionId)) {
    return NextResponse.json({ error: "今日のミッションではありません。" }, { status: 400 });
  }

  const limit = checkRateLimit(`osanpo-run-mission:${user.id}`, 20, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: "record_osanpo_run_mission",
    args: { p_mission_id: string },
  ) => Promise<RpcResponse>;

  const { data, error } = await rpc("record_osanpo_run_mission", { p_mission_id: missionId });
  if (error) {
    if (error.code && RECORD_UNAVAILABLE_CODES.has(error.code)) {
      return NextResponse.json({ ok: true, ready: false }, { headers: { "Cache-Control": "no-store" } });
    }
    console.error("Failed to record osanpo run mission", { code: error.code, message: error.message });
    return NextResponse.json({ error: "ミッションを記録できませんでした。" }, { status: 400 });
  }

  const result = toRecord(data);
  return NextResponse.json(
    {
      ok: true,
      ready: true,
      applied: result.applied === true,
      coins: typeof result.coins === "number" ? result.coins : 0,
      completed: typeof result.completed === "number" ? result.completed : 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
