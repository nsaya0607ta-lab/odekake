import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { parsePlacements, ROOM_MAX_PLACEMENTS } from "@/lib/room/decor";
import type { Json } from "@/lib/supabase/types";
import { requireUser } from "@/lib/supabase/server";

/** テーブルがまだ無い環境（マイグレーション前）。端末に保存するよう返す */
const UNAVAILABLE_CODES = new Set(["42P01", "PGRST205"]);

/** おへやの置き方を保存する（何を置けるかは表示のたびに確かめるので、ここでは形だけ整える） */
export async function PUT(request: Request) {
  const { supabase, user } = await requireUser();
  const limit = checkRateLimit(`room-save:${user.id}`, 120, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const body = (await request.json().catch(() => null)) as { placements?: unknown } | null;
  if (!body || !Array.isArray(body.placements) || body.placements.length > ROOM_MAX_PLACEMENTS) {
    return NextResponse.json({ error: "置き方が正しくありません。" }, { status: 400 });
  }
  const placements = parsePlacements(body.placements);
  const { error } = await supabase
    .from("user_decoration_rooms")
    .upsert({ user_id: user.id, placements: placements as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) {
    if (UNAVAILABLE_CODES.has(error.code ?? "")) return NextResponse.json({ ok: true, ready: false }, { headers: { "Cache-Control": "no-store" } });
    console.error("Failed to save decoration room", { code: error.code, message: error.message });
    return NextResponse.json({ error: "保存できませんでした。" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ready: true }, { headers: { "Cache-Control": "no-store" } });
}
