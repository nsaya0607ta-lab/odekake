"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { toJapaneseError } from "@/lib/errors";
import { finalizePhotoPaths } from "@/lib/photos";
import { requireUser } from "@/lib/supabase/server";
import { PHOTO_BUCKET } from "@/lib/data/client";

const uuidSchema = z.string().uuid();
const MAX_CAPTION_LENGTH = 300;

/** JST（Asia/Tokyo）の「今日」をYYYY-MM-DDで返す。DB側の判定はこれとは独立して行う */
function todayInTokyo(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
}

function parsePhotoPaths(formData: FormData): string[] {
  try {
    const raw = String(formData.get("photoPaths") ?? "[]");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string");
  } catch {
    return [];
  }
}

export async function createFriendPhotosAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const requestedPaths = parsePhotoPaths(formData);
  const caption = String(formData.get("caption") ?? "").trim().slice(0, MAX_CAPTION_LENGTH) || null;

  if (requestedPaths.length === 0) {
    return { error: "写真を選んでください。" };
  }

  const { supabase, user } = await requireUser();
  const destinationPrefix = `friend-photos/${user.id}/${todayInTokyo()}`;
  const paths = [...new Set(await finalizePhotoPaths(supabase, requestedPaths, destinationPrefix))];

  if (paths.length === 0) {
    return { error: "写真の送信が完了するまでお待ちください。" };
  }

  for (const path of paths) {
    const { error } = await supabase.rpc("create_friend_photo", {
      p_storage_path: path,
      p_caption: caption,
    });
    if (error) {
      return { error: toJapaneseError(error, "写真の投稿に失敗しました。") };
    }
  }

  revalidatePath("/sns");
  redirect("/sns?posted=1");
}

export async function deleteFriendPhotoAction(formData: FormData): Promise<void> {
  const parsed = uuidSchema.safeParse(String(formData.get("photoId") ?? ""));
  if (!parsed.success) redirect("/sns");

  const { supabase } = await requireUser();
  const { data: storagePath, error } = await supabase.rpc("delete_friend_photo", {
    p_photo_id: parsed.data,
  });
  if (error) {
    redirect(`/sns/${parsed.data}?error=delete`);
  }
  if (storagePath) {
    await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
  }

  revalidatePath("/sns");
  redirect("/sns");
}

export async function setFriendPhotoReactionAction(formData: FormData): Promise<void> {
  const photoId = String(formData.get("photoId") ?? "");
  const parsedPhotoId = uuidSchema.safeParse(photoId);
  if (!parsedPhotoId.success) redirect("/sns");

  const emoji = String(formData.get("emoji") ?? "").trim();
  const { supabase } = await requireUser();
  await supabase.rpc("set_friend_photo_reaction", {
    p_photo_id: parsedPhotoId.data,
    p_emoji: emoji === "" ? null : emoji,
  });

  revalidatePath(`/sns/${parsedPhotoId.data}`);
  revalidatePath("/sns");
  redirect(`/sns/${parsedPhotoId.data}`);
}

export async function addFriendPhotoCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const photoId = String(formData.get("photoId") ?? "");
  const parsedPhotoId = uuidSchema.safeParse(photoId);
  const body = String(formData.get("body") ?? "").trim();

  if (!parsedPhotoId.success) return { error: "この写真は見つかりませんでした。" };
  if (body === "") return { error: "コメントを入力してください。", values: { body: "" } };

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("add_friend_photo_comment", {
    p_photo_id: parsedPhotoId.data,
    p_body: body,
  });
  if (error) {
    return { error: toJapaneseError(error, "コメントの投稿に失敗しました。"), values: { body } };
  }

  revalidatePath(`/sns/${parsedPhotoId.data}`);
  return { ok: true };
}

export async function deleteFriendPhotoCommentAction(formData: FormData): Promise<void> {
  const commentId = String(formData.get("commentId") ?? "");
  const photoId = String(formData.get("photoId") ?? "");
  const parsedCommentId = uuidSchema.safeParse(commentId);
  const parsedPhotoId = uuidSchema.safeParse(photoId);
  if (!parsedCommentId.success || !parsedPhotoId.success) redirect("/sns");

  const { supabase } = await requireUser();
  await supabase.rpc("delete_friend_photo_comment", { p_comment_id: parsedCommentId.data });

  revalidatePath(`/sns/${parsedPhotoId.data}`);
  redirect(`/sns/${parsedPhotoId.data}`);
}
