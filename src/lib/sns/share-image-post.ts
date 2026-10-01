import { NextResponse } from "next/server";
import { PHOTO_BUCKET } from "@/lib/data/client";
import { todayInJapan } from "@/lib/date";
import { toJapaneseError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

/** 画面でつくったカード（1080px 前後のJPEG）はふつう数百KB。これより大きいものは受け付けない */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_BODY_LENGTH = 280;
const MIGRATION_CODES = new Set(["PGRST202", "42883"]);

const isJpeg = (bytes: Uint8Array) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

/**
 * アプリの画面でつくった画像（ゲームの結果カード・おへやの記念写真など）を、
 * SNS（フレンドへの投稿）に写真つきで投稿する API の中身。
 * 画像は自分の投稿写真と同じ friend-photos/{自分}/posts/{日付}/ に置く。
 * フォームの image（JPEG）と body（本文）を受け取る。
 */
export async function handleShareImagePost(request: Request, opts: { feature: string; filePrefix: string }) {
  const { supabase, user } = await requireUser();

  const limit = checkRateLimit(`${opts.feature}-share:${user.id}`, 10, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "すこし時間をおいてからお試しください。" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  const body = String(form?.get("body") ?? "").trim();
  if (!(image instanceof Blob) || image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "画像が正しくありません。" }, { status: 400 });
  }
  if (body.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: `${MAX_BODY_LENGTH}文字以内で入力してください。` }, { status: 400 });
  }
  const bytes = new Uint8Array(await image.arrayBuffer());
  if (!isJpeg(bytes)) {
    return NextResponse.json({ error: "画像が正しくありません。" }, { status: 400 });
  }

  const path = `friend-photos/${user.id}/posts/${todayInJapan()}/${opts.filePrefix}-${crypto.randomUUID()}.jpg`;
  const storage = supabase.storage.from(PHOTO_BUCKET);
  const { error: uploadError } = await storage.upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (uploadError) {
    console.error("Failed to upload a share image", { feature: opts.feature, message: uploadError.message });
    return NextResponse.json({ error: "画像を保存できませんでした。" }, { status: 400 });
  }

  // SNSの投稿画面と同じく、新しい引数が無い古いDBでも投稿できるようにする
  let { error } = await supabase.rpc("create_friend_text_post", {
    p_body: body,
    p_photo_paths: [path],
    p_visit_record_id: null,
    p_repost_of_post_id: null,
  });
  if (error && MIGRATION_CODES.has(error.code ?? "")) {
    ({ error } = await supabase.rpc("create_friend_text_post", { p_body: body, p_photo_paths: [path], p_visit_record_id: null }));
  }
  if (error && MIGRATION_CODES.has(error.code ?? "")) {
    ({ error } = await supabase.rpc("create_friend_text_post", { p_body: body, p_photo_paths: [path] }));
  }
  if (error) {
    void storage.remove([path]);
    console.error("Failed to post a share image", { feature: opts.feature, code: error.code, message: error.message });
    return NextResponse.json({ error: toJapaneseError(error, "投稿できませんでした。") }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
