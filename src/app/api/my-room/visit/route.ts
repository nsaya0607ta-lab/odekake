import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 置き手紙の長さ（DB の制約と同じ） */
const ROOM_NOTE_MAX = 60;

type Body = { friendId?: unknown; action?: unknown; body?: unknown; noteId?: unknown };

/**
 * フレンドの部屋への「いいね」と置き手紙。
 * フレンドかどうかは RLS（room_likes / room_notes の insert ポリシー）で確かめる。
 */
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  const input = (await request.json().catch(() => null)) as Body | null;
  const friendId = typeof input?.friendId === "string" ? input.friendId : "";
  if (!UUID.test(friendId) || friendId === user.id) return NextResponse.json({ error: "おへやが見つかりませんでした。" }, { status: 400 });

  if (input?.action === "like" || input?.action === "unlike") {
    const limit = checkRateLimit(`room-like:${user.id}`, 120, 60 * 60_000);
    if (!limit.allowed) return tooMany(limit.retryAfterSeconds);
    const { error } = input.action === "like"
      ? await supabase.from("room_likes").upsert({ room_owner: friendId, user_id: user.id }, { onConflict: "room_owner,user_id", ignoreDuplicates: true })
      : await supabase.from("room_likes").delete().eq("room_owner", friendId).eq("user_id", user.id);
    if (error) return failed(error, "いいねできませんでした。");
    const { data } = await supabase.rpc("get_friend_room", { p_friend_user_id: friendId });
    return NextResponse.json({ ok: true, liked: data?.[0]?.liked ?? input.action === "like", likeCount: data?.[0]?.like_count ?? null }, { headers: { "Cache-Control": "no-store" } });
  }

  if (input?.action === "note") {
    const body = typeof input.body === "string" ? input.body.replace(/\s+/g, " ").trim() : "";
    if (!body || [...body].length > ROOM_NOTE_MAX) return NextResponse.json({ error: `置き手紙は1〜${ROOM_NOTE_MAX}文字で書いてください。` }, { status: 400 });
    const limit = checkRateLimit(`room-note:${user.id}`, 20, 60 * 60_000);
    if (!limit.allowed) return tooMany(limit.retryAfterSeconds);
    const { data, error } = await supabase.from("room_notes").insert({ room_owner: friendId, author_id: user.id, body }).select("id, body, created_at").single();
    if (error || !data) return failed(error, "置き手紙を置けませんでした。");
    return NextResponse.json({ ok: true, note: { id: data.id, body: data.body, createdAt: data.created_at } }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ error: "できない操作です。" }, { status: 400 });
}

/** 置き手紙を消す（書いた人か、部屋の持ち主だけ。RLS で確かめる） */
export async function DELETE(request: Request) {
  const { supabase } = await requireUser();
  const input = (await request.json().catch(() => null)) as Body | null;
  const noteId = typeof input?.noteId === "string" ? input.noteId : "";
  if (!UUID.test(noteId)) return NextResponse.json({ error: "置き手紙が見つかりませんでした。" }, { status: 400 });
  const { error } = await supabase.from("room_notes").delete().eq("id", noteId);
  if (error) return failed(error, "消せませんでした。");
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

function tooMany(retryAfter: number) {
  return NextResponse.json({ error: "すこし時間をおいてからお試しください。" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}

function failed(error: { code?: string; message?: string } | null, message: string) {
  // 42501 = RLS（フレンドではない）
  if (error?.code === "42501") return NextResponse.json({ error: "フレンドのおへやにだけ置けます。" }, { status: 403 });
  console.error(message, { code: error?.code, message: error?.message });
  return NextResponse.json({ error: message }, { status: 400 });
}
