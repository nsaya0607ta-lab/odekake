"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { PHOTO_BUCKET } from "@/lib/data/client";
import { deleteAdminNotice, postAdminNotice, updateAdminNotice } from "@/lib/data/notices";
import { finalizePhotoPaths } from "@/lib/photos";
import { requireUser } from "@/lib/supabase/server";

const titleSchema = z.string().trim().min(1, "タイトルを入力してください").max(100, "100文字以内で入力してください");
const messageSchema = z.string().trim().min(1, "本文を入力してください").max(2000, "2000文字以内で入力してください");
const noticeIdSchema = z.string().uuid();

/** PhotoUploaderのhidden inputはアップロード済みパスのJSON配列文字列 */
function parseImagePaths(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export async function postAdminNoticeAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const title = titleSchema.safeParse(formData.get("title"));
  const message = messageSchema.safeParse(formData.get("message"));
  if (!title.success || !message.success) {
    return {
      error: title.error?.issues[0]?.message ?? message.error?.issues[0]?.message ?? "入力内容を確認してください",
      values: { title: String(formData.get("title") ?? ""), message: String(formData.get("message") ?? "") },
    };
  }

  const { supabase } = await requireUser();
  const imagePaths = parseImagePaths(formData.get("imagePaths"));

  let imagePath: string | null = null;
  if (imagePaths[0]) {
    const [moved] = await finalizePhotoPaths(supabase, [imagePaths[0]], `notices/${randomUUID()}`);
    if (!moved) {
      return {
        error: "画像を保存できませんでした。もう一度お試しください",
        values: { title: title.data, message: message.data },
      };
    }
    imagePath = moved;
  }

  try {
    await postAdminNotice(supabase, title.data, message.data, imagePath);
  } catch {
    if (imagePath) await supabase.storage.from(PHOTO_BUCKET).remove([imagePath]);
    return {
      error: "お知らせを投稿できませんでした。もう一度お試しください",
      values: { title: title.data, message: message.data },
    };
  }

  revalidatePath("/notices");
  revalidatePath("/notices/admin");
  revalidatePath("/home");
  return { ok: true, message: "お知らせを配信しました" };
}

export async function updateAdminNoticeAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const noticeId = noticeIdSchema.safeParse(formData.get("noticeId"));
  const title = titleSchema.safeParse(formData.get("title"));
  const message = messageSchema.safeParse(formData.get("message"));
  if (!noticeId.success || !title.success || !message.success) {
    return {
      error: title.error?.issues[0]?.message ?? message.error?.issues[0]?.message ?? "入力内容を確認してください",
      values: { title: String(formData.get("title") ?? ""), message: String(formData.get("message") ?? "") },
    };
  }

  const { supabase } = await requireUser();
  const imagePaths = parseImagePaths(formData.get("imagePaths"));
  const previousImagePathRaw = formData.get("previousImagePath");
  const previousImagePath = typeof previousImagePathRaw === "string" && previousImagePathRaw.length > 0
    ? previousImagePathRaw
    : null;

  let imagePath: string | null = null;
  if (imagePaths[0]) {
    const [moved] = await finalizePhotoPaths(supabase, [imagePaths[0]], `notices/${noticeId.data}`);
    if (!moved) {
      return {
        error: "画像を保存できませんでした。もう一度お試しください",
        values: { title: title.data, message: message.data },
      };
    }
    imagePath = moved;
  }

  try {
    await updateAdminNotice(supabase, noticeId.data, title.data, message.data, imagePath);
  } catch {
    return {
      error: "お知らせを更新できませんでした。もう一度お試しください",
      values: { title: title.data, message: message.data },
    };
  }

  if (previousImagePath && previousImagePath !== imagePath) {
    await supabase.storage.from(PHOTO_BUCKET).remove([previousImagePath]);
  }

  revalidatePath("/notices");
  revalidatePath("/notices/admin");
  revalidatePath("/home");
  return { ok: true, message: "お知らせを更新しました" };
}

export async function deleteAdminNoticeAction(formData: FormData): Promise<void> {
  const noticeId = noticeIdSchema.safeParse(formData.get("noticeId"));
  if (!noticeId.success) return;

  const { supabase } = await requireUser();
  const imagePath = await deleteAdminNotice(supabase, noticeId.data);
  if (imagePath) await supabase.storage.from(PHOTO_BUCKET).remove([imagePath]);

  revalidatePath("/notices");
  revalidatePath("/notices/admin");
  revalidatePath("/home");
}
