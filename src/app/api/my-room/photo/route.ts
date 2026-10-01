import { NextResponse } from "next/server";
import { PHOTO_BUCKET } from "@/lib/data/client";
import { toThumbPath } from "@/lib/image";
import { checkRateLimit } from "@/lib/rate-limit";
import { isRoomPhotoPath } from "@/lib/room/types";
import { requireUser } from "@/lib/supabase/server";

/** 端末で縮めてから送るので、ふつうは数百KB。これより大きいものは受け付けない */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_THUMB_BYTES = 1024 * 1024;

const isJpeg = (bytes: Uint8Array) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

async function readJpeg(value: FormDataEntryValue | null, max: number): Promise<Uint8Array | null> {
  if (!(value instanceof Blob) || value.size === 0 || value.size > max) return null;
  const bytes = new Uint8Array(await value.arrayBuffer());
  return isJpeg(bytes) ? bytes : null;
}

/**
 * わんこのおへやに飾る写真をアップロードする（端末で縮めた本体とサムネイルのJPEG）。
 * 置き場所は users/{自分}/room/{id}.jpg。どこに飾るかは、おへやの保存（PUT /api/my-room）で持つ。
 */
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  const limit = checkRateLimit(`my-room-photo:${user.id}`, 40, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "すこし時間をおいてからお試しください。" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  const form = await request.formData().catch(() => null);
  const [image, thumb] = await Promise.all([readJpeg(form?.get("image") ?? null, MAX_IMAGE_BYTES), readJpeg(form?.get("thumb") ?? null, MAX_THUMB_BYTES)]);
  if (!image || !thumb) return NextResponse.json({ error: "写真を読みこめませんでした。" }, { status: 400 });

  const id = crypto.randomUUID();
  const path = `users/${user.id}/room/${id}.jpg`;
  const storage = supabase.storage.from(PHOTO_BUCKET);
  const { error } = await storage.upload(path, image, { contentType: "image/jpeg", upsert: false });
  if (error) {
    console.error("Failed to upload a room photo", { message: error.message });
    return NextResponse.json({ error: "写真を保存できませんでした。" }, { status: 400 });
  }
  // サムネイルが無くても原寸で表示できるので、失敗しても止めない
  await storage.upload(toThumbPath(path), thumb, { contentType: "image/jpeg", upsert: false }).catch(() => null);
  return NextResponse.json({ ok: true, id, path }, { headers: { "Cache-Control": "no-store" } });
}

/** アップロードした写真を消す（自分のフォルダのものだけ） */
export async function DELETE(request: Request) {
  const { supabase, user } = await requireUser();
  const body = (await request.json().catch(() => null)) as { path?: unknown } | null;
  const path = typeof body?.path === "string" ? body.path : "";
  if (!isRoomPhotoPath(path, user.id)) return NextResponse.json({ error: "写真が見つかりませんでした。" }, { status: 400 });
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path, toThumbPath(path)]);
  if (error) {
    console.error("Failed to remove a room photo", { message: error.message });
    return NextResponse.json({ error: "写真を消せませんでした。" }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
