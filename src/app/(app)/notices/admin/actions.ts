"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { deleteAdminNotice, postAdminNotice, updateAdminNotice } from "@/lib/data/notices";
import { requireUser } from "@/lib/supabase/server";

const titleSchema = z.string().trim().min(1, "タイトルを入力してください").max(100, "100文字以内で入力してください");
const messageSchema = z.string().trim().min(1, "本文を入力してください").max(2000, "2000文字以内で入力してください");
const noticeIdSchema = z.string().uuid();

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
  try {
    await postAdminNotice(supabase, title.data, message.data);
  } catch {
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
  try {
    await updateAdminNotice(supabase, noticeId.data, title.data, message.data);
  } catch {
    return {
      error: "お知らせを更新できませんでした。もう一度お試しください",
      values: { title: title.data, message: message.data },
    };
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
  await deleteAdminNotice(supabase, noticeId.data);

  revalidatePath("/notices");
  revalidatePath("/notices/admin");
  revalidatePath("/home");
}
