"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form";
import { toJapaneseError } from "@/lib/errors";
import { toThumbPath } from "@/lib/image";
import { finalizePhotoPaths } from "@/lib/photos";
import { requireUser } from "@/lib/supabase/server";
import { PHOTO_BUCKET } from "@/lib/data/client";
import { signPhotoPaths, signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getFriendTextPostReplies, getPersonalTextPost, getSnsPhoto } from "@/lib/data/sns";
import {
  getSnsNotificationReadSnapshot,
  MAX_DISMISSED_IDS,
  ownLikeCount,
  SNS_NOTIFICATION_DISMISSED_IDS_KEY,
  SNS_NOTIFICATION_LIKE_COUNTS_KEY,
  SNS_MUTED_GROUP_IDS_KEY,
  SNS_NOTIFICATION_PREFERENCES_KEY,
  SNS_NOTIFICATION_SEEN_AT_KEY,
} from "@/lib/data/sns-notifications";

const uuidSchema = z.string().uuid();
const MAX_CAPTION_LENGTH = 300;
const MAX_GROUP_NAME_LENGTH = 40;
const SNS_FEATURE_MIGRATION_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

export type SnsMutationResult = { ok: true } | { ok: false; error: string };
export type SnsFullPhotoUrlsResult =
  | { ok: true; urls: Record<string, string> }
  | { ok: false; error: string };

function snsMutationError(error: { code?: string; message?: string } | null, fallback: string): string {
  if (error?.code && SNS_FEATURE_MIGRATION_CODES.has(error.code)) {
    return "この機能を使うにはSupabaseのSNS更新が必要です。";
  }
  return toJapaneseError(error, fallback);
}

/** JST（Asia/Tokyo）の「今日」をYYYY-MM-DDで返す。DB側の判定はこれとは独立して行う */
function todayInTokyo(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
}

function parseJsonPaths(formData: FormData, field: string): string[] {
  try {
    const raw = String(formData.get(field) ?? "[]");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string");
  } catch {
    return [];
  }
}

function parsePhotoPaths(formData: FormData): string[] {
  return parseJsonPaths(formData, "photoPaths");
}

function parseMemberIds(formData: FormData): string[] {
  return formData
    .getAll("memberUserIds")
    .map((v) => String(v))
    .filter((v) => uuidSchema.safeParse(v).success);
}

/** 原寸写真は一覧表示時には署名せず、拡大表示を開いた時だけ取得する。 */
export async function getFriendTextPostFullPhotoUrlsAction(postId: string): Promise<SnsFullPhotoUrlsResult> {
  const parsedPostId = uuidSchema.safeParse(postId);
  if (!parsedPostId.success) return { ok: false, error: "この投稿は見つかりませんでした。" };

  try {
    const { supabase } = await requireUser();
    const post = await getPersonalTextPost(supabase, parsedPostId.data);
    if (!post) return { ok: false, error: "この投稿は表示できません。" };
    const paths = [...new Set([...post.photo_paths, ...post.quoted_photo_paths])];
    const urls = await signPhotoPaths(supabase, paths);
    return { ok: true, urls: Object.fromEntries(urls) };
  } catch {
    return { ok: false, error: "写真を読み込めませんでした。" };
  }
}

export async function createFriendPhotosAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const requestedPaths = parsePhotoPaths(formData);
  const caption = String(formData.get("caption") ?? "").trim().slice(0, MAX_CAPTION_LENGTH) || null;
  const groupId = uuidSchema.parse(String(formData.get("groupId") ?? ""));

  if (requestedPaths.length === 0) {
    return { error: "写真を選んでください。", values: { caption: caption ?? "" } };
  }

  const { supabase, user } = await requireUser();
  const destinationPrefix = `friend-photos/${user.id}/group/${groupId}/${todayInTokyo()}`;
  const paths = [...new Set(await finalizePhotoPaths(supabase, requestedPaths, destinationPrefix))];

  if (paths.length === 0) {
    return { error: "写真の送信が完了するまでお待ちください。", values: { caption: caption ?? "" } };
  }

  for (const path of paths) {
    const { error } = await supabase.rpc("create_friend_photo", {
      p_storage_path: path,
      p_caption: caption,
      p_group_id: groupId,
    });
    if (error) {
      return { error: toJapaneseError(error, "写真の投稿に失敗しました。"), values: { caption: caption ?? "" } };
    }
  }

  revalidatePath(`/sns/groups/${groupId}`);
  redirect(`/sns/groups/${groupId}?posted=1`);
}

const MAX_TEXT_POST_PHOTOS = 4;

export async function createFriendTextPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const body = String(formData.get("body") ?? "").trim();
  const requestedPhotoPaths = parsePhotoPaths(formData).slice(0, MAX_TEXT_POST_PHOTOS);
  const linkedVisitValue = String(formData.get("linkedVisitId") ?? "");
  const parsedLinkedVisitId = linkedVisitValue === "" ? null : uuidSchema.safeParse(linkedVisitValue);
  const linkedVisitId = parsedLinkedVisitId?.success ? parsedLinkedVisitId.data : null;
  const repostOfValue = String(formData.get("repostOfPostId") ?? "");
  const parsedRepostOfId = repostOfValue === "" ? null : uuidSchema.safeParse(repostOfValue);
  const repostOfPostId = parsedRepostOfId?.success ? parsedRepostOfId.data : null;

  if (linkedVisitValue !== "" && !parsedLinkedVisitId?.success) {
    return { error: "選択したおでかけ記録を確認してください。", values: { body, linkedVisitId: "" } };
  }

  if (repostOfValue !== "" && !parsedRepostOfId?.success) {
    return { error: "引用する投稿を確認してください。", values: { body, linkedVisitId: linkedVisitId ?? "" } };
  }

  if (body === "" && requestedPhotoPaths.length === 0 && repostOfPostId === null) {
    return { error: "つぶやきを入力するか、写真を選んでください。", values: { body, linkedVisitId: linkedVisitId ?? "" } };
  }
  if (body.length > 280) {
    return { error: "280文字以内で入力してください。", values: { body, linkedVisitId: linkedVisitId ?? "" } };
  }

  const { supabase, user } = await requireUser();
  const destinationPrefix = `friend-photos/${user.id}/posts/${todayInTokyo()}`;
  const photoPaths =
    requestedPhotoPaths.length > 0
      ? [...new Set(await finalizePhotoPaths(supabase, requestedPhotoPaths, destinationPrefix))]
      : [];

  let { error } = await supabase.rpc("create_friend_text_post", {
    p_body: body,
    p_photo_paths: photoPaths,
    p_visit_record_id: linkedVisitId,
    p_repost_of_post_id: repostOfPostId,
  });
  // DBマイグレーション適用前でも、紐づけなしの従来投稿は止めない。
  if (error && repostOfPostId === null && (error.code === "PGRST202" || error.code === "42883")) {
    ({ error } = await supabase.rpc("create_friend_text_post", {
      p_body: body,
      p_photo_paths: photoPaths,
      p_visit_record_id: linkedVisitId,
    }));
  }
  if (
    error
    && repostOfPostId === null
    && linkedVisitId === null
    && (error.code === "PGRST202" || error.code === "42883")
  ) {
    ({ error } = await supabase.rpc("create_friend_text_post", {
      p_body: body,
      p_photo_paths: photoPaths,
    }));
  }
  if (error) {
    const needsMigration = (linkedVisitId !== null || repostOfPostId !== null)
      && (error.code === "PGRST202" || error.code === "42883");
    return {
      error: needsMigration
        ? repostOfPostId
          ? "引用投稿を保存するには、SupabaseのSNS更新が必要です。"
          : "場所・旅行の紐づけを保存するには、SupabaseのSQL更新が必要です。"
        : toJapaneseError(error, "投稿に失敗しました。"),
      values: { body, linkedVisitId: linkedVisitId ?? "" },
    };
  }

  revalidatePath("/sns/home");
  revalidatePath(`/sns/users/${user.id}`);
  redirect("/sns/home?posted=1");
}

export async function deleteFriendTextPostAction(formData: FormData): Promise<SnsMutationResult> {
  const parsed = uuidSchema.safeParse(String(formData.get("postId") ?? ""));
  if (!parsed.success) return { ok: false, error: "この投稿は見つかりませんでした。" };

  const { supabase, user } = await requireUser();
  const { data: photoPaths, error } = await supabase.rpc("delete_friend_text_post", { p_post_id: parsed.data });
  if (error) return { ok: false, error: snsMutationError(error, "投稿を削除できませんでした。") };

  if (photoPaths && photoPaths.length > 0) {
    const objectPaths = photoPaths.flatMap((path) => [path, toThumbPath(path)]);
    await supabase.storage.from(PHOTO_BUCKET).remove(objectPaths);
  }

  revalidatePath("/sns/home");
  revalidatePath(`/sns/users/${user.id}`);
  return { ok: true };
}

export async function setFriendTextPostLikeAction(formData: FormData): Promise<SnsMutationResult> {
  const postId = String(formData.get("postId") ?? "");
  const authorUserId = String(formData.get("authorUserId") ?? "");
  const parsedPostId = uuidSchema.safeParse(postId);
  if (!parsedPostId.success) return { ok: false, error: "この投稿は見つかりませんでした。" };

  const liked = String(formData.get("liked") ?? "") === "1";
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_friend_text_post_like", {
    p_post_id: parsedPostId.data,
    p_liked: liked,
  });
  if (error) return { ok: false, error: toJapaneseError(error, "いいねを更新できませんでした。") };

  revalidatePath("/sns/home");
  revalidatePath(`/sns/posts/${parsedPostId.data}`);
  if (uuidSchema.safeParse(authorUserId).success) revalidatePath(`/sns/users/${authorUserId}`);
  return { ok: true };
}

export async function setFriendTextPostSavedAction(formData: FormData): Promise<SnsMutationResult> {
  const postId = String(formData.get("postId") ?? "");
  const parsedPostId = uuidSchema.safeParse(postId);
  if (!parsedPostId.success) return { ok: false, error: "この投稿は見つかりませんでした。" };

  const saved = String(formData.get("saved") ?? "") === "1";
  const { supabase, user } = await requireUser();
  const { error } = await supabase.rpc("set_friend_text_post_saved", {
    p_post_id: parsedPostId.data,
    p_saved: saved,
  });
  if (error) return { ok: false, error: snsMutationError(error, "保存できませんでした。") };

  revalidatePath("/sns/home");
  revalidatePath(`/sns/users/${user.id}`);
  revalidatePath(`/sns/posts/${parsedPostId.data}`);
  return { ok: true };
}

export async function setFriendTextPostRepostAction(formData: FormData): Promise<SnsMutationResult> {
  const postId = String(formData.get("postId") ?? "");
  const parsedPostId = uuidSchema.safeParse(postId);
  if (!parsedPostId.success) return { ok: false, error: "この投稿は見つかりませんでした。" };

  const reposted = String(formData.get("reposted") ?? "") === "1";
  const { supabase, user } = await requireUser();
  const { error } = await supabase.rpc("set_friend_text_post_repost", {
    p_post_id: parsedPostId.data,
    p_reposted: reposted,
  });
  if (error) return { ok: false, error: snsMutationError(error, "リポストできませんでした。") };

  revalidatePath("/sns/home");
  revalidatePath(`/sns/users/${user.id}`);
  revalidatePath(`/sns/posts/${parsedPostId.data}`);
  return { ok: true };
}

export async function setFriendTextPostPinAction(formData: FormData): Promise<SnsMutationResult> {
  const postId = String(formData.get("postId") ?? "");
  const parsedPostId = uuidSchema.safeParse(postId);
  if (!parsedPostId.success) return { ok: false, error: "この投稿は見つかりませんでした。" };

  const pinned = String(formData.get("pinned") ?? "") === "1";
  const { supabase, user } = await requireUser();
  const { error } = await supabase.rpc("set_friend_text_post_pin", {
    p_post_id: parsedPostId.data,
    p_pinned: pinned,
  });
  if (error) return { ok: false, error: snsMutationError(error, "固定できませんでした。") };

  revalidatePath(`/sns/users/${user.id}`);
  revalidatePath(`/sns/posts/${parsedPostId.data}`);
  return { ok: true };
}

export async function addFriendTextPostReplyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const postId = String(formData.get("postId") ?? "");
  const parsedPostId = uuidSchema.safeParse(postId);
  const rawParentReplyId = String(formData.get("parentReplyId") ?? "");
  const parentReplyId = uuidSchema.safeParse(rawParentReplyId).success ? rawParentReplyId : null;
  const body = String(formData.get("body") ?? "").trim();

  if (!parsedPostId.success) return { error: "この投稿は見つかりませんでした。" };
  if (body === "") return { error: "返信を入力してください。", values: { body: "" } };
  if (body.length > 1000) return { error: "1000文字以内で入力してください。", values: { body } };

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("add_friend_text_post_reply", {
    p_post_id: parsedPostId.data,
    p_body: body,
    p_parent_reply_id: parentReplyId,
  });
  if (error) {
    return { error: toJapaneseError(error, "返信の投稿に失敗しました。"), values: { body } };
  }

  revalidatePath(`/sns/posts/${parsedPostId.data}`);
  revalidatePath("/sns/home");
  return { ok: true };
}

export async function deleteFriendTextPostReplyAction(formData: FormData): Promise<SnsMutationResult> {
  const replyId = String(formData.get("replyId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const parsedReplyId = uuidSchema.safeParse(replyId);
  const parsedPostId = uuidSchema.safeParse(postId);
  if (!parsedReplyId.success || !parsedPostId.success) {
    return { ok: false, error: "この返信は見つかりませんでした。" };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_friend_text_post_reply", { p_reply_id: parsedReplyId.data });
  if (error) return { ok: false, error: snsMutationError(error, "返信を削除できませんでした。") };

  revalidatePath(`/sns/posts/${parsedPostId.data}`);
  revalidatePath("/sns/home");
  return { ok: true };
}

export async function setFriendTextPostReplyLikeAction(formData: FormData): Promise<SnsMutationResult> {
  const replyId = String(formData.get("replyId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const parsedReplyId = uuidSchema.safeParse(replyId);
  if (!parsedReplyId.success) return { ok: false, error: "この返信は見つかりませんでした。" };

  const liked = String(formData.get("liked") ?? "") === "1";
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_friend_text_post_reply_like", {
    p_reply_id: parsedReplyId.data,
    p_liked: liked,
  });
  if (error) return { ok: false, error: toJapaneseError(error, "返信のいいねを更新できませんでした。") };

  if (uuidSchema.safeParse(postId).success) revalidatePath(`/sns/posts/${postId}`);
  revalidatePath("/sns/home");
  return { ok: true };
}

/** ホーム/ユーザー画面のカードでコメントアイコンを開いたときに、その場で返信一覧を取得する */
export async function getPostRepliesAction(postId: string): Promise<
  {
    id: string;
    parentReplyId: string | null;
    userId: string;
    displayName: string;
    avatarUrl?: string;
    body: string;
    createdAt: string;
    likeCount: number;
    myLiked: boolean;
    mentions: { user_id: string; display_name: string }[];
  }[]
> {
  const parsedPostId = uuidSchema.safeParse(postId);
  if (!parsedPostId.success) return [];

  const { supabase } = await requireUser();
  const replies = await getFriendTextPostReplies(supabase, parsedPostId.data);
  const avatarUrls = await signThumbOrOriginalPaths(
    supabase,
    replies.flatMap((r) => (r.profile_image_url ? [r.profile_image_url] : [])),
  );

  return replies.map((r) => ({
    id: r.id,
    parentReplyId: r.parent_reply_id,
    userId: r.user_id,
    displayName: r.display_name,
    avatarUrl: r.profile_image_url ? avatarUrls.get(r.profile_image_url) : undefined,
    body: r.body,
    createdAt: r.created_at,
    likeCount: r.like_count,
    myLiked: r.my_liked,
    mentions: r.mentions,
  }));
}

export async function deleteFriendPhotoAction(formData: FormData): Promise<SnsMutationResult> {
  const parsed = uuidSchema.safeParse(String(formData.get("photoId") ?? ""));
  if (!parsed.success) return { ok: false, error: "この写真は見つかりませんでした。" };

  const { supabase } = await requireUser();
  const photo = await getSnsPhoto(supabase, parsed.data).catch(() => null);

  const { data: storagePath, error } = await supabase.rpc("delete_friend_photo", {
    p_photo_id: parsed.data,
  });

  if (error) {
    return { ok: false, error: snsMutationError(error, "写真を削除できませんでした。") };
  }
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove([storagePath, toThumbPath(storagePath)]);
    if (storageError) console.warn("Deleted SNS photo row but storage cleanup failed", { message: storageError.message });
  }

  revalidatePath("/sns");
  if (photo?.group_id) revalidatePath(`/sns/groups/${photo.group_id}`);
  return { ok: true };
}

export async function setFriendPhotoReactionAction(formData: FormData): Promise<SnsMutationResult> {
  const photoId = String(formData.get("photoId") ?? "");
  const parsedPhotoId = uuidSchema.safeParse(photoId);
  if (!parsedPhotoId.success) return { ok: false, error: "この写真は見つかりませんでした。" };

  const emoji = String(formData.get("emoji") ?? "").trim();
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_friend_photo_reaction", {
    p_photo_id: parsedPhotoId.data,
    p_emoji: emoji === "" ? null : emoji,
  });
  if (error) return { ok: false, error: snsMutationError(error, "リアクションを更新できませんでした。") };

  revalidatePath(`/sns/${parsedPhotoId.data}`);
  revalidatePath("/sns");
  return { ok: true };
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

export async function deleteFriendPhotoCommentAction(formData: FormData): Promise<SnsMutationResult> {
  const commentId = String(formData.get("commentId") ?? "");
  const photoId = String(formData.get("photoId") ?? "");
  const parsedCommentId = uuidSchema.safeParse(commentId);
  const parsedPhotoId = uuidSchema.safeParse(photoId);
  if (!parsedCommentId.success || !parsedPhotoId.success) {
    return { ok: false, error: "このコメントは見つかりませんでした。" };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_friend_photo_comment", { p_comment_id: parsedCommentId.data });
  if (error) return { ok: false, error: snsMutationError(error, "コメントを削除できませんでした。") };

  revalidatePath(`/sns/${parsedPhotoId.data}`);
  return { ok: true };
}

// -------------------------------------------------------------
// グループ
// -------------------------------------------------------------

export async function createFriendGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_GROUP_NAME_LENGTH);
  const memberUserIds = parseMemberIds(formData);
  const iconPaths = parseJsonPaths(formData, "iconPaths");

  if (name === "") {
    return { error: "グループ名を入力してください。", values: { name } };
  }
  if (memberUserIds.length === 0) {
    return { error: "メンバーを1人以上選んでください。", values: { name } };
  }

  const { supabase } = await requireUser();
  const { data: groupId, error } = await supabase.rpc("create_friend_group", {
    p_name: name,
    p_member_user_ids: memberUserIds,
  });
  if (error || !groupId) {
    return { error: toJapaneseError(error, "グループを作成できませんでした。"), values: { name } };
  }

  if (iconPaths[0]) {
    const [moved] = await finalizePhotoPaths(supabase, [iconPaths[0]], `groups/${groupId}/icon`);
    if (moved) {
      await supabase.rpc("update_friend_group", { p_group_id: groupId, p_icon_path: moved });
    }
  }

  revalidatePath("/sns");
  redirect(`/sns/groups/${groupId}`);
}

export async function updateFriendGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const parsedGroupId = uuidSchema.safeParse(groupId);
  if (!parsedGroupId.success) return { error: "このグループは見つかりませんでした。" };

  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_GROUP_NAME_LENGTH);
  if (name === "") {
    return { error: "グループ名を入力してください。", values: { name } };
  }
  const iconPaths = parseJsonPaths(formData, "iconPaths");

  const { supabase } = await requireUser();

  const { data: currentGroups } = await supabase.rpc("get_my_friend_groups");
  const previousIconPath = currentGroups?.find((g) => g.id === groupId)?.icon_path ?? null;

  // アイコンの入力欄が空で送られてきたら「アイコンを外した」と扱う
  const removeIcon = iconPaths.length === 0 && previousIconPath !== null;

  let iconPath: string | null | undefined;
  if (removeIcon) {
    iconPath = null;
  } else if (iconPaths[0]) {
    const [moved] = await finalizePhotoPaths(supabase, [iconPaths[0]], `groups/${groupId}/icon`);
    if (!moved) {
      return { error: "アイコン画像を保存できませんでした。もう一度お試しください。", values: { name } };
    }
    iconPath = moved;
  }

  const { error } = await supabase.rpc("update_friend_group", {
    p_group_id: groupId,
    p_name: name,
    p_icon_path: iconPath,
    p_remove_icon: removeIcon,
  });
  if (error) {
    return { error: toJapaneseError(error, "グループの設定を更新できませんでした。"), values: { name } };
  }

  if (previousIconPath && iconPath !== undefined && previousIconPath !== iconPath) {
    await supabase.storage.from(PHOTO_BUCKET).remove([previousIconPath]);
  }

  revalidatePath("/sns");
  revalidatePath(`/sns/groups/${groupId}`);
  revalidatePath(`/sns/groups/${groupId}/settings`);
  return { ok: true, message: "グループの設定を更新しました。", values: { name } };
}

/** グループアイコンの長押しドラッグ並び替え用。フォームを介さず直接呼び出す */
export async function reorderFriendGroupsAction(groupIds: string[]): Promise<SnsMutationResult> {
  const parsed = groupIds.filter((id) => uuidSchema.safeParse(id).success);
  if (parsed.length === 0) return { ok: false, error: "並び順を確認してください。" };

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("reorder_friend_groups", { p_group_ids: parsed });
  if (error) return { ok: false, error: snsMutationError(error, "並び順を保存できませんでした。") };
  revalidatePath("/sns");
  return { ok: true };
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

export async function deleteFriendGroupMessageAction(formData: FormData): Promise<SnsMutationResult> {
  const messageId = String(formData.get("messageId") ?? "");
  const groupId = String(formData.get("groupId") ?? "");
  const parsedMessageId = uuidSchema.safeParse(messageId);
  const parsedGroupId = uuidSchema.safeParse(groupId);
  if (!parsedMessageId.success || !parsedGroupId.success) {
    return { ok: false, error: "このメッセージは見つかりませんでした。" };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_friend_group_message", { p_message_id: parsedMessageId.data });
  if (error) return { ok: false, error: snsMutationError(error, "メッセージを削除できませんでした。") };

  revalidatePath(`/sns/groups/${parsedGroupId.data}`);
  return { ok: true };
}

export async function setFriendGroupPinAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const parsedGroupId = uuidSchema.safeParse(groupId);
  const clearing = String(formData.get("clear") ?? "") === "1";
  const title = clearing ? "" : String(formData.get("title") ?? "").trim();
  const body = clearing ? "" : String(formData.get("body") ?? "").trim();
  if (!parsedGroupId.success) return { error: "このグループは見つかりませんでした。" };
  if (title.length > 60 || body.length > 300) {
    return { error: "タイトルは60文字、詳細は300文字以内で入力してください。", values: { title, body } };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_friend_group_pin", {
    p_group_id: parsedGroupId.data,
    p_title: title,
    p_body: body,
  });
  if (error) {
    return { error: snsMutationError(error, "固定カードを更新できませんでした。"), values: { title, body } };
  }

  revalidatePath(`/sns/groups/${parsedGroupId.data}`);
  return { ok: true, message: title ? "グループ上部に固定しました。" : "固定を解除しました。" };
}

/** 固定解除は保存フォームのsubmitter値に依存させず、専用アクションで確実に削除する。 */
export async function clearFriendGroupPinAction(formData: FormData): Promise<SnsMutationResult> {
  const parsedGroupId = uuidSchema.safeParse(String(formData.get("groupId") ?? ""));
  if (!parsedGroupId.success) return { ok: false, error: "このグループは見つかりませんでした。" };

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_friend_group_pin", {
    p_group_id: parsedGroupId.data,
    p_title: "",
    p_body: "",
  });
  if (error) return { ok: false, error: snsMutationError(error, "固定を解除できませんでした。") };

  revalidatePath(`/sns/groups/${parsedGroupId.data}`);
  return { ok: true };
}

export async function createFriendGroupPollAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const parsedGroupId = uuidSchema.safeParse(groupId);
  const question = String(formData.get("question") ?? "").trim();
  const repeatedOptions = formData.getAll("options");
  const optionValues = repeatedOptions.length > 0
    ? repeatedOptions
    : [0, 1, 2, 3].map((index) => formData.get(`option${index}`));
  const options = optionValues
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .slice(0, 4);
  const closesAtRaw = String(formData.get("closesAt") ?? "");
  // datetime-local はタイムゾーンを含まないため、利用者の基準である日本時間として保存する。
  const closesAtSource = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(closesAtRaw)
    ? `${closesAtRaw}:00+09:00`
    : closesAtRaw;
  const closesAt = closesAtSource && !Number.isNaN(Date.parse(closesAtSource))
    ? new Date(closesAtSource).toISOString()
    : null;

  if (!parsedGroupId.success) return { error: "このグループは見つかりませんでした。" };
  if (question === "" || question.length > 120) {
    return { error: "質問を120文字以内で入力してください。", values: { question } };
  }
  if (options.length < 2) {
    return { error: "選択肢を2つ以上入力してください。", values: { question } };
  }
  if (closesAt && Date.parse(closesAt) <= Date.now()) {
    return { error: "締切は現在より後の日時を選んでください。", values: { question } };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_friend_group_poll", {
    p_group_id: parsedGroupId.data,
    p_question: question,
    p_options: options,
    p_closes_at: closesAt,
  });
  if (error) {
    return { error: snsMutationError(error, "投票を作成できませんでした。"), values: { question } };
  }

  revalidatePath(`/sns/groups/${parsedGroupId.data}`);
  return { ok: true, message: "投票を作成しました。" };
}

export async function voteFriendGroupPollAction(formData: FormData): Promise<SnsMutationResult> {
  const pollId = uuidSchema.safeParse(String(formData.get("pollId") ?? ""));
  const optionId = uuidSchema.safeParse(String(formData.get("optionId") ?? ""));
  const groupId = uuidSchema.safeParse(String(formData.get("groupId") ?? ""));
  if (!pollId.success || !optionId.success || !groupId.success) {
    return { ok: false, error: "投票内容を確認してください。" };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("vote_friend_group_poll", {
    p_poll_id: pollId.data,
    p_option_id: optionId.data,
  });
  if (error) return { ok: false, error: snsMutationError(error, "投票できませんでした。") };
  revalidatePath(`/sns/groups/${groupId.data}`);
  return { ok: true };
}

export async function deleteFriendGroupPollAction(formData: FormData): Promise<SnsMutationResult> {
  const pollId = uuidSchema.safeParse(String(formData.get("pollId") ?? ""));
  const groupId = uuidSchema.safeParse(String(formData.get("groupId") ?? ""));
  if (!pollId.success || !groupId.success) return { ok: false, error: "この投票は見つかりませんでした。" };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_friend_group_poll", { p_poll_id: pollId.data });
  if (error) return { ok: false, error: snsMutationError(error, "投票を削除できませんでした。") };
  revalidatePath(`/sns/groups/${groupId.data}`);
  return { ok: true };
}

export async function markFriendGroupReadAction(groupId: string): Promise<void> {
  const parsed = uuidSchema.safeParse(groupId);
  if (!parsed.success) return;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_friend_group_read", { p_group_id: parsed.data });
  if (error) throw new Error(snsMutationError(error, "グループを既読にできませんでした。"));
  revalidatePath("/sns");
  revalidatePath("/sns/notifications");
}

/**
 * 通知を1件だけタップして開いたときに、その1件だけを既読にする。
 * 返信・メンションはID単位で既読リストへ積み、いいねはその投稿の
 * 現在のいいね数をスナップショットへ反映する。グループは既存の
 * markFriendGroupReadAction 側で処理されるためここでは扱わない。
 */
export async function markSnsNotificationItemReadAction(itemId: string): Promise<void> {
  const [kind, ...rest] = itemId.split(":");
  const rawId = rest.join(":");
  if (!rawId) return;

  const { supabase } = await requireUser();

  if (kind === "reply" || kind === "mention") {
    const { data } = await supabase.auth.getClaims();
    const metadata = (data?.claims?.user_metadata ?? {}) as Record<string, unknown>;
    const existing = metadata[SNS_NOTIFICATION_DISMISSED_IDS_KEY];
    const dismissedIds = new Set(Array.isArray(existing) ? existing.filter((id) => typeof id === "string") : []);
    dismissedIds.add(itemId);
    const trimmed = [...dismissedIds].slice(-MAX_DISMISSED_IDS);

    const { error } = await supabase.auth.updateUser({
      data: { [SNS_NOTIFICATION_DISMISSED_IDS_KEY]: trimmed },
    });
    if (error) {
      console.error("Failed to mark SNS notification item as read", { message: error.message });
      return;
    }
    await supabase.auth.refreshSession().catch(() => {});
    revalidatePath("/sns/notifications");
    return;
  }

  if (kind === "like") {
    const postId = uuidSchema.safeParse(rawId);
    if (!postId.success) return;
    const post = await getPersonalTextPost(supabase, postId.data).catch(() => null);
    if (!post) return;

    const { data } = await supabase.auth.getClaims();
    const metadata = (data?.claims?.user_metadata ?? {}) as Record<string, unknown>;
    const existingCounts = metadata[SNS_NOTIFICATION_LIKE_COUNTS_KEY];
    const likeCounts: Record<string, number> = existingCounts && typeof existingCounts === "object"
      ? { ...(existingCounts as Record<string, number>) }
      : {};
    likeCounts[postId.data] = ownLikeCount(post);

    const { error } = await supabase.auth.updateUser({
      data: { [SNS_NOTIFICATION_LIKE_COUNTS_KEY]: likeCounts },
    });
    if (error) {
      console.error("Failed to mark SNS like notification as read", { message: error.message });
      return;
    }
    await supabase.auth.refreshSession().catch(() => {});
    revalidatePath("/sns/notifications");
  }
}

/** 通知一覧の現在値をスナップショットとして保存し、グループ未読もまとめて既読にする。 */
export async function markSnsNotificationsReadAction(): Promise<void> {
  const { supabase, user } = await requireUser();
  const seenAt = new Date().toISOString();
  const snapshot = await getSnsNotificationReadSnapshot(supabase, user.id);

  const groupReadResults = await Promise.all(
    snapshot.unreadGroupIds.map((groupId) =>
      supabase.rpc("mark_friend_group_read", { p_group_id: groupId }),
    ),
  );
  const groupReadError = groupReadResults.find((result) => result.error)?.error;

  const { error } = await supabase.auth.updateUser({
    data: {
      [SNS_NOTIFICATION_SEEN_AT_KEY]: seenAt,
      [SNS_NOTIFICATION_LIKE_COUNTS_KEY]: snapshot.likeCounts,
      [SNS_NOTIFICATION_DISMISSED_IDS_KEY]: [],
    },
  });

  if (!error) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn("Failed to refresh SNS notification read state", { message: refreshError.message });
    }
  }
  revalidatePath("/sns");
  revalidatePath("/sns/notifications");

  if (error || groupReadError) {
    console.error("Failed to mark SNS notifications as read", {
      authMessage: error?.message,
      groupMessage: groupReadError?.message,
    });
    redirect("/sns/notifications?error=read");
  }

  redirect("/sns/notifications?read=1");
}

export async function updateSnsNotificationSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const mutedGroupIds = formData
    .getAll("mutedGroupIds")
    .map((value) => String(value))
    .filter((id) => uuidSchema.safeParse(id).success);
  const preferences = {
    replies: formData.get("notifyReplies") === "on",
    likes: formData.get("notifyLikes") === "on",
    mentions: formData.get("notifyMentions") === "on",
    groups: formData.get("notifyGroups") === "on",
  };

  const { supabase } = await requireUser();
  const { error } = await supabase.auth.updateUser({
    data: {
      [SNS_NOTIFICATION_PREFERENCES_KEY]: preferences,
      [SNS_MUTED_GROUP_IDS_KEY]: [...new Set(mutedGroupIds)],
    },
  });
  if (error) return { error: "通知設定を保存できませんでした。" };

  await supabase.auth.refreshSession();
  revalidatePath("/sns");
  revalidatePath("/sns/notifications");
  revalidatePath("/sns/settings");
  return { ok: true, message: "通知設定を保存しました。" };
}

export async function setSnsUserBlockAction(formData: FormData): Promise<SnsMutationResult> {
  const userId = uuidSchema.safeParse(String(formData.get("userId") ?? ""));
  if (!userId.success) return { ok: false, error: "ユーザーを確認してください。" };
  const blocked = String(formData.get("blocked") ?? "") === "1";

  const { supabase, user } = await requireUser();
  if (user.id === userId.data) return { ok: false, error: "自分自身はブロックできません。" };
  const { error } = await supabase.rpc("set_sns_user_block", {
    p_user_id: userId.data,
    p_blocked: blocked,
  });
  if (error) return { ok: false, error: snsMutationError(error, "ブロック設定を変更できませんでした。") };

  revalidatePath("/sns/home");
  revalidatePath("/sns/search");
  revalidatePath("/sns/settings");
  revalidatePath(`/sns/users/${userId.data}`);
  return { ok: true };
}

export async function reportSnsPostAction(formData: FormData): Promise<SnsMutationResult> {
  const postId = uuidSchema.safeParse(String(formData.get("postId") ?? ""));
  if (!postId.success) return { ok: false, error: "投稿を確認してください。" };
  const reason = String(formData.get("reason") ?? "不適切な投稿").trim().slice(0, 120) || "不適切な投稿";

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("report_sns_post", {
    p_post_id: postId.data,
    p_reason: reason,
  });
  if (error) return { ok: false, error: snsMutationError(error, "通報を送信できませんでした。") };
  return { ok: true };
}
