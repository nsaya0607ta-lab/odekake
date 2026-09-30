import { NextResponse } from "next/server";
import { z } from "zod";
import { toJapaneseError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

const bodySchema = z.object({ postId: z.string().uuid(), liked: z.boolean() });

/** おさんぽフレンチーの結果画面から、フレンドの投稿（気球が運んできた思い出）にいいねする */
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "この投稿は見つかりませんでした。" }, { status: 400 });

  const limit = checkRateLimit(`osanpo-run-like:${user.id}`, 60, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const { error } = await supabase.rpc("set_friend_text_post_like", { p_post_id: parsed.data.postId, p_liked: parsed.data.liked });
  if (error) {
    console.error("Failed to like a friend post from osanpo run", { code: error.code, message: error.message });
    return NextResponse.json({ error: toJapaneseError(error, "いいねを更新できませんでした。") }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
