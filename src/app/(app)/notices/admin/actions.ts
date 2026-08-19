"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { postAdminNotice } from "@/lib/data/notices";
import { requireUser } from "@/lib/supabase/server";

const messageSchema = z.string().trim().min(1, "本文を入力してください").max(500, "500文字以内で入力してください");

export async function postAdminNoticeAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = messageSchema.safeParse(formData.get("message"));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
      values: { message: String(formData.get("message") ?? "") },
    };
  }

  const { supabase } = await requireUser();
  try {
    await postAdminNotice(supabase, parsed.data);
  } catch {
    return {
      error: "お知らせを投稿できませんでした。もう一度お試しください",
      values: { message: parsed.data },
    };
  }

  revalidatePath("/notices");
  revalidatePath("/home");
  return { ok: true, message: "お知らせを配信しました" };
}
