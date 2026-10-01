import { NextResponse } from "next/server";
import { getCurrentDogSkin } from "@/lib/data/dog-skin";
import { buildRoomShowcase } from "@/lib/data/my-room";
import { checkRateLimit } from "@/lib/rate-limit";
import { isRoomPhotoPath, parseRoomLayout, ROOM_MAX_ITEMS, uploadKey } from "@/lib/room/types";
import type { Json } from "@/lib/supabase/types";
import { requireUser } from "@/lib/supabase/server";

/** テーブルがまだ無い環境（マイグレーション前）。端末に保存するよう返す */
const UNAVAILABLE_CODES = new Set(["42P01", "PGRST205"]);

/** わんこのおへやの飾り方を保存する（何を置けるかは表示のたびに確かめるので、ここでは形だけ整える） */
export async function PUT(request: Request) {
  const { supabase, user } = await requireUser();
  const limit = checkRateLimit(`my-room:${user.id}`, 150, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const body = (await request.json().catch(() => null)) as { layout?: { items?: unknown } } | null;
  if (!body?.layout || typeof body.layout !== "object" || (Array.isArray(body.layout.items) && body.layout.items.length > ROOM_MAX_ITEMS)) {
    return NextResponse.json({ error: "飾り方が正しくありません。" }, { status: 400 });
  }
  const parsed = parseRoomLayout(body.layout);
  // アップロードした写真は自分のフォルダのものだけ。外したものに置いていた分も外す
  const photos = parsed.photos.filter((ph) => isRoomPhotoPath(ph.path, user.id));
  const keep = new Set(photos.map((ph) => uploadKey(ph.id)));
  const layout = { ...parsed, photos, items: parsed.items.filter((p) => !p.key.startsWith("upload:") || keep.has(p.key)) };
  // フレンドが部屋を見るときの、飾ったものの見た目もいっしょに書く
  const showcase = await buildRoomShowcase(supabase, user.id, layout, await getCurrentDogSkin(supabase, user.id)).catch(() => null);
  const row: { user_id: string; layout: Json; updated_at: string; showcase?: Json } = { user_id: user.id, layout: layout as unknown as Json, updated_at: new Date().toISOString() };
  let { error } = await supabase
    .from("user_rooms")
    .upsert(showcase ? { ...row, showcase: showcase as unknown as Json } : row, { onConflict: "user_id" });
  // showcase の列がまだ無い環境（0110 適用前）では、飾り方だけ保存する
  if (error && showcase && (error.code === "42703" || error.code === "PGRST204")) {
    ({ error } = await supabase.from("user_rooms").upsert(row, { onConflict: "user_id" }));
  }
  if (error) {
    if (UNAVAILABLE_CODES.has(error.code ?? "")) return NextResponse.json({ ok: true, ready: false }, { headers: { "Cache-Control": "no-store" } });
    console.error("Failed to save my room", { code: error.code, message: error.message });
    return NextResponse.json({ error: "保存できませんでした。" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ready: true }, { headers: { "Cache-Control": "no-store" } });
}
