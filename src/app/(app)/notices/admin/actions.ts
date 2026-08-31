"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { NOTICE_HTML_BUCKET, PHOTO_BUCKET } from "@/lib/data/client";
import { deleteAdminNotice, postAdminNotice, updateAdminNotice } from "@/lib/data/notices";
import { finalizePhotoPaths } from "@/lib/photos";
import { requireUser } from "@/lib/supabase/server";

const titleSchema = z.string().trim().min(1, "タイトルを入力してください").max(100, "100文字以内で入力してください");
const messageSchema = z.string().trim().min(1, "本文を入力してください").max(2000, "2000文字以内で入力してください");
const noticeIdSchema = z.string().uuid();
const linkUrlSchema = z
  .string()
  .trim()
  .max(2000, "URLが長すぎます")
  .regex(/^https?:\/\//i, "http(s)から始まるURLを入力してください")
  .or(z.literal(""));

function parseLinkUrl(raw: FormDataEntryValue | null): { ok: true; value: string | null } | { ok: false; error: string } {
  const result = linkUrlSchema.safeParse(typeof raw === "string" ? raw : "");
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? "URLを確認してください" };
  }
  return { ok: true, value: result.data.length > 0 ? result.data : null };
}

/** PhotoUploader/HtmlFileUploaderのhidden inputはアップロード済みパスのJSON配列文字列 */
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
  const linkUrl = parseLinkUrl(formData.get("linkUrl"));
  if (!title.success || !message.success || !linkUrl.ok) {
    return {
      error:
        title.error?.issues[0]?.message
        ?? message.error?.issues[0]?.message
        ?? (!linkUrl.ok ? linkUrl.error : undefined)
        ?? "入力内容を確認してください",
      values: { title: String(formData.get("title") ?? ""), message: String(formData.get("message") ?? "") },
    };
  }

  const { supabase } = await requireUser();
  const imagePaths = parseImagePaths(formData.get("imagePaths"));
  const htmlPaths = parseImagePaths(formData.get("htmlPaths"));

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

  let htmlPath: string | null = null;
  if (htmlPaths[0]) {
    const [moved] = await finalizePhotoPaths(supabase, [htmlPaths[0]], `notices/${randomUUID()}`, NOTICE_HTML_BUCKET);
    if (!moved) {
      if (imagePath) await supabase.storage.from(PHOTO_BUCKET).remove([imagePath]);
      return {
        error: "添付ファイルを保存できませんでした。もう一度お試しください",
        values: { title: title.data, message: message.data },
      };
    }
    htmlPath = moved;
  }

  try {
    await postAdminNotice(supabase, title.data, message.data, imagePath, linkUrl.value, htmlPath);
  } catch {
    if (imagePath) await supabase.storage.from(PHOTO_BUCKET).remove([imagePath]);
    if (htmlPath) await supabase.storage.from(NOTICE_HTML_BUCKET).remove([htmlPath]);
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
  const linkUrl = parseLinkUrl(formData.get("linkUrl"));
  if (!noticeId.success || !title.success || !message.success || !linkUrl.ok) {
    return {
      error:
        title.error?.issues[0]?.message
        ?? message.error?.issues[0]?.message
        ?? (!linkUrl.ok ? linkUrl.error : undefined)
        ?? "入力内容を確認してください",
      values: { title: String(formData.get("title") ?? ""), message: String(formData.get("message") ?? "") },
    };
  }

  const { supabase } = await requireUser();
  const imagePaths = parseImagePaths(formData.get("imagePaths"));
  const htmlPaths = parseImagePaths(formData.get("htmlPaths"));
  const previousImagePathRaw = formData.get("previousImagePath");
  const previousImagePath = typeof previousImagePathRaw === "string" && previousImagePathRaw.length > 0
    ? previousImagePathRaw
    : null;
  const previousHtmlPathRaw = formData.get("previousHtmlPath");
  const previousHtmlPath = typeof previousHtmlPathRaw === "string" && previousHtmlPathRaw.length > 0
    ? previousHtmlPathRaw
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

  let htmlPath: string | null = null;
  if (htmlPaths[0]) {
    const [moved] = await finalizePhotoPaths(
      supabase,
      [htmlPaths[0]],
      `notices/${noticeId.data}`,
      NOTICE_HTML_BUCKET,
    );
    if (!moved) {
      return {
        error: "添付ファイルを保存できませんでした。もう一度お試しください",
        values: { title: title.data, message: message.data },
      };
    }
    htmlPath = moved;
  }

  try {
    await updateAdminNotice(supabase, noticeId.data, title.data, message.data, imagePath, linkUrl.value, htmlPath);
  } catch {
    return {
      error: "お知らせを更新できませんでした。もう一度お試しください",
      values: { title: title.data, message: message.data },
    };
  }

  if (previousImagePath && previousImagePath !== imagePath) {
    await supabase.storage.from(PHOTO_BUCKET).remove([previousImagePath]);
  }
  if (previousHtmlPath && previousHtmlPath !== htmlPath) {
    await supabase.storage.from(NOTICE_HTML_BUCKET).remove([previousHtmlPath]);
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
  const removed = await deleteAdminNotice(supabase, noticeId.data);
  if (removed.imagePath) await supabase.storage.from(PHOTO_BUCKET).remove([removed.imagePath]);
  if (removed.htmlPath) await supabase.storage.from(NOTICE_HTML_BUCKET).remove([removed.htmlPath]);

  revalidatePath("/notices");
  revalidatePath("/notices/admin");
  revalidatePath("/home");
}
