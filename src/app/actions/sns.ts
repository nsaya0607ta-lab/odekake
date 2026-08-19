"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { toJapaneseError } from "@/lib/errors";
import { finalizePhotoPaths } from "@/lib/photos";
import { requireUser } from "@/lib/supabase/server";
import { PHOTO_BUCKET } from "@/lib/data/client";
import { getSnsPhoto } from "@/lib/data/sns";
import { GROUP_ICON_CHOICES } from "@/lib/sns-group-icons";

const uuidSchema = z.string().uuid();
const optionalUuidSchema = z.string().uuid().optional().or(z.literal(""));
const MAX_CAPTION_LENGTH = 300;
const MAX_GROUP_NAME_LENGTH = 40;

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

function parseMemberIds(formData: FormData): string[] {
  return formData
    .getAll("memberUserIds")
    .map((v) => String(v))
    .filter((v) => uuidSchema.safeParse(v).success);
}

export async function createFriendPhotosAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const requestedPaths = parsePhotoPaths(formData);
  const caption = String(formData.get("caption") ?? "").trim().slice(0, MAX_CAPTION_LENGTH) || null;
  const rawGroupId = String(formData.get("groupId") ?? "");
  const groupId = optionalUuidSchema.safeParse(rawGroupId).success && rawGroupId !== "" ? rawGroupId : null;

  if (requestedPaths.length === 0) {
    return { error: "写真を選んでください。" };
  }

  const { supabase, user } = await requireUser();
  const destinationPrefix = groupId
    ? `friend-photos/${user.id}/group/${groupId}/${todayInTokyo()}`
    : `friend-photos/${user.id}/${todayInTokyo()}`;
  const paths = [...new Set(await finalizePhotoPaths(supabase, requestedPaths, destinationPrefix))];

  if (paths.length === 0) {
    return { error: "写真の送信が完了するまでお待ちください。" };
  }

  for (const path of paths) {
    const { error } = await supabase.rpc("create_friend_photo", {
      p_storage_path: path,
      p_caption: caption,
      p_group_id: groupId,
    });
    if (error) {
      return { error: toJapaneseError(error, "写真の投稿に失敗しました。") };
    }
  }

  const redirectTo = groupId ? `/sns/groups/${groupId}?posted=1` : "/sns?posted=1";
  revalidatePath("/sns");
  if (groupId) revalidatePath(`/sns/groups/${groupId}`);
  redirect(redirectTo);
}

export async function deleteFriendPhotoAction(formData: FormData): Promise<void> {
  const parsed = uuidSchema.safeParse(String(formData.get("photoId") ?? ""));
  if (!parsed.success) redirect("/sns");

  const { supabase } = await requireUser();
  const photo = await getSnsPhoto(supabase, parsed.data).catch(() => null);

  const { data: storagePath, error } = await supabase.rpc("delete_friend_photo", {
    p_photo_id: parsed.data,
  });

  const fallback = photo?.group_id ? `/sns/groups/${photo.group_id}` : "/sns";
  if (error) {
    redirect(`/sns/${parsed.data}?error=delete`);
  }
  if (storagePath) {
    await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
  }

  revalidatePath("/sns");
  if (photo?.group_id) revalidatePath(`/sns/groups/${photo.group_id}`);
  redirect(fallback);
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

// -------------------------------------------------------------
// グループ
// -------------------------------------------------------------

export async function createFriendGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_GROUP_NAME_LENGTH);
  const memberUserIds = parseMemberIds(formData);
  const rawIcon = String(formData.get("icon") ?? "");
  const icon = GROUP_ICON_CHOICES.includes(rawIcon) ? rawIcon : GROUP_ICON_CHOICES[0];

  if (name === "") {
    return { error: "グループ名を入力してください。", values: { name } };
  }

  const { supabase } = await requireUser();
  const { data: groupId, error } = await supabase.rpc("create_friend_group", {
    p_name: name,
    p_member_user_ids: memberUserIds,
    p_icon: icon,
  });
  if (error || !groupId) {
    return { error: toJapaneseError(error, "グループを作成できませんでした。"), values: { name } };
  }

  revalidatePath("/sns");
  redirect(`/sns/groups/${groupId}`);
}

/** グループアイコンの長押しドラッグ並び替え用。フォームを介さず直接呼び出す */
export async function reorderFriendGroupsAction(groupIds: string[]): Promise<void> {
  const parsed = groupIds.filter((id) => uuidSchema.safeParse(id).success);
  if (parsed.length === 0) return;

  const { supabase } = await requireUser();
  await supabase.rpc("reorder_friend_groups", { p_group_ids: parsed });
  revalidatePath("/sns");
}

export async function addFriendGroupMembersAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const parsedGroupId = uuidSchema.safeParse(groupId);
  const memberUserIds = parseMemberIds(formData);
  if (!parsedGroupId.success) return { error: "このグループは見つかりませんでした。" };

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("add_friend_group_members", {
    p_group_id: parsedGroupId.data,
    p_member_user_ids: memberUserIds,
  });
  if (error) {
    return { error: toJapaneseError(error, "メンバーを追加できませんでした。") };
  }

  revalidatePath(`/sns/groups/${parsedGroupId.data}/settings`);
  return { ok: true, message: "メンバーを追加しました" };
}

export async function leaveFriendGroupAction(formData: FormData): Promise<void> {
  const parsed = uuidSchema.safeParse(String(formData.get("groupId") ?? ""));
  if (!parsed.success) redirect("/sns");

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("leave_friend_group", { p_group_id: parsed.data });
  if (error) {
    redirect(`/sns/groups/${parsed.data}/settings?error=leave`);
  }

  revalidatePath("/sns");
  redirect("/sns");
}

export async function deleteFriendGroupAction(formData: FormData): Promise<void> {
  const parsed = uuidSchema.safeParse(String(formData.get("groupId") ?? ""));
  if (!parsed.success) redirect("/sns");

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_friend_group", { p_group_id: parsed.data });
  if (error) {
    redirect(`/sns/groups/${parsed.data}/settings?error=delete`);
  }

  revalidatePath("/sns");
  redirect("/sns");
}

export async function createFriendGroupMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const parsedGroupId = uuidSchema.safeParse(groupId);
  const body = String(formData.get("body") ?? "").trim();

  if (!parsedGroupId.success) return { error: "このグループは見つかりませんでした。" };
  if (body === "") return { error: "メッセージを入力してください。", values: { body: "" } };

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_friend_group_message", {
    p_group_id: parsedGroupId.data,
    p_body: body,
  });
  if (error) {
    return { error: toJapaneseError(error, "メッセージの投稿に失敗しました。"), values: { body } };
  }

  revalidatePath(`/sns/groups/${parsedGroupId.data}`);
  return { ok: true };
}

export async function deleteFriendGroupMessageAction(formData: FormData): Promise<void> {
  const messageId = String(formData.get("messageId") ?? "");
  const groupId = String(formData.get("groupId") ?? "");
  const parsedMessageId = uuidSchema.safeParse(messageId);
  const parsedGroupId = uuidSchema.safeParse(groupId);
  if (!parsedMessageId.success || !parsedGroupId.success) redirect("/sns");

  const { supabase } = await requireUser();
  await supabase.rpc("delete_friend_group_message", { p_message_id: parsedMessageId.data });

  revalidatePath(`/sns/groups/${parsedGroupId.data}`);
  redirect(`/sns/groups/${parsedGroupId.data}?view=chat`);
}

export async function markFriendGroupReadAction(groupId: string): Promise<void> {
  const parsed = uuidSchema.safeParse(groupId);
  if (!parsed.success) return;
  const { supabase } = await requireUser();
  await supabase.rpc("mark_friend_group_read", { p_group_id: parsed.data });
}
