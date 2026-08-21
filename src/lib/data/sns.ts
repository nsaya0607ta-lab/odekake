import { unstable_cache } from "next/cache";
import type { DB } from "./client";
import { signThumbOrOriginalPaths } from "./photos";
import type {
  FriendGroupMemberRow,
  FriendGroupMessageRow,
  FriendGroupRow,
  SnsCommentRow,
  SnsFeedPhotoRow,
  SnsPhotoRow,
  SnsTextPostReplyRow,
  SnsTextPostRow,
} from "@/lib/supabase/types";

/** フィードで遡って表示する日数 */
export const SNS_FEED_DAYS = 30;

export async function getSnsGroupFeed(
  supabase: DB,
  groupId: string,
  days: number = SNS_FEED_DAYS,
): Promise<SnsFeedPhotoRow[]> {
  const { data, error } = await supabase.rpc("get_sns_group_feed", { p_group_id: groupId, p_days: days });
  if (error) {
    console.error("SNS group feed is unavailable", { code: error.code, message: error.message });
    throw new Error("グループの写真の取得に失敗しました");
  }
  return data ?? [];
}

/** グループに紐付かないテキストの個人投稿（つぶやき）だけのフィード。userId を省略すると
 * フレンド全員分をまとめたホームフィードに、指定するとそのユーザー1人分だけの投稿一覧になる */
export async function getPersonalTextFeed(supabase: DB, userId?: string, limit = 100): Promise<SnsTextPostRow[]> {
  const { data, error } = await supabase.rpc("get_personal_text_feed", { p_user_id: userId ?? null, p_limit: limit });
  if (error) {
    console.error("Personal text feed is unavailable", { code: error.code, message: error.message });
    throw new Error("投稿の取得に失敗しました");
  }
  return data ?? [];
}

/** つぶやき1件を取得する（返信画面のヘッダー用）。見えない・存在しない場合は null */
export async function getPersonalTextPost(supabase: DB, postId: string): Promise<SnsTextPostRow | null> {
  const { data, error } = await supabase.rpc("get_personal_text_post", { p_post_id: postId });
  if (error) {
    console.error("Personal text post is unavailable", { code: error.code, message: error.message });
    throw new Error("投稿の取得に失敗しました");
  }
  return data?.[0] ?? null;
}

export async function getFriendTextPostReplies(supabase: DB, postId: string): Promise<SnsTextPostReplyRow[]> {
  const { data, error } = await supabase.rpc("get_friend_text_post_replies", { p_post_id: postId });
  if (error) {
    console.error("Text post replies are unavailable", { code: error.code, message: error.message });
    throw new Error("返信の取得に失敗しました");
  }
  return data ?? [];
}

export async function getSnsPhoto(supabase: DB, photoId: string): Promise<SnsPhotoRow | null> {
  const { data, error } = await supabase.rpc("get_sns_photo", { p_photo_id: photoId });
  if (error) {
    console.error("SNS photo is unavailable", { code: error.code, message: error.message });
    throw new Error("写真の取得に失敗しました");
  }
  return data?.[0] ?? null;
}

async function fetchMyFriendGroups(supabase: DB): Promise<FriendGroupRow[]> {
  const { data, error } = await supabase.rpc("get_my_friend_groups");
  if (error) {
    console.error("Friend groups are unavailable", { code: error.code, message: error.message });
    throw new Error("グループの取得に失敗しました");
  }
  return data ?? [];
}

export function friendGroupsCacheTag(userId: string): string {
  return `friend-groups:${userId}`;
}

/**
 * 参加グループの一覧はグループの作成・脱退・並び替えなど以外ではほぼ変わらないため、
 * ユーザーごとにキャッシュしてグループ切り替えのたびの再取得を避ける。
 * 一覧を変更するアクション側で friendGroupsCacheTag(userId) を revalidateTag する
 */
export async function getMyFriendGroups(supabase: DB, userId: string): Promise<FriendGroupRow[]> {
  const cached = unstable_cache(() => fetchMyFriendGroups(supabase), ["my-friend-groups", userId], {
    tags: [friendGroupsCacheTag(userId)],
  });
  return cached();
}

/** グループアイコン画像の署名付きURLをまとめて取得する */
export async function signGroupIconUrls(supabase: DB, groups: FriendGroupRow[]): Promise<Map<string, string>> {
  const paths = groups.flatMap((g) => (g.icon_path ? [g.icon_path] : []));
  if (paths.length === 0) return new Map();
  return signThumbOrOriginalPaths(supabase, paths);
}

/** SNSの切り替えバーに出す、自分（個人アカウント）の表示名とアイコンURL */
export async function getOwnSnsProfile(supabase: DB, userId: string): Promise<{ displayName: string; iconUrl?: string }> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, profile_image_url")
    .eq("user_id", userId)
    .maybeSingle();

  const iconPath = data?.profile_image_url ?? null;
  const iconUrl = iconPath ? (await signThumbOrOriginalPaths(supabase, [iconPath])).get(iconPath) : undefined;

  return { displayName: data?.display_name ?? "自分", iconUrl };
}

/** 特定ユーザーの表示名とアイコンURL。フレンド視点の可視性チェックをした上で返す
 * （profilesテーブルのRLSは本人の行しか読めないため、getOwnSnsProfileは他人には使えない） */
export async function getFriendProfile(supabase: DB, userId: string): Promise<{ displayName: string; iconUrl?: string }> {
  const { data, error } = await supabase.rpc("get_friend_profile", { p_user_id: userId });
  if (error) {
    console.error("Friend profile is unavailable", { code: error.code, message: error.message });
    throw new Error("プロフィールの取得に失敗しました");
  }

  const row = data?.[0];
  const iconPath = row?.profile_image_url ?? null;
  const iconUrl = iconPath ? (await signThumbOrOriginalPaths(supabase, [iconPath])).get(iconPath) : undefined;

  return { displayName: row?.display_name ?? "不明なユーザー", iconUrl };
}

export async function getFriendGroupMembers(supabase: DB, groupId: string): Promise<FriendGroupMemberRow[]> {
  const { data, error } = await supabase.rpc("get_friend_group_members", { p_group_id: groupId });
  if (error) {
    console.error("Friend group members are unavailable", { code: error.code, message: error.message });
    throw new Error("メンバーの取得に失敗しました");
  }
  return data ?? [];
}

export async function getFriendGroupMessages(
  supabase: DB,
  groupId: string,
  limit = 50,
): Promise<FriendGroupMessageRow[]> {
  const { data, error } = await supabase.rpc("get_friend_group_messages", { p_group_id: groupId, p_limit: limit });
  if (error) {
    console.error("Friend group messages are unavailable", { code: error.code, message: error.message });
    throw new Error("チャットの取得に失敗しました");
  }
  return data ?? [];
}

export async function getFriendPhotoComments(supabase: DB, photoId: string): Promise<SnsCommentRow[]> {
  const { data, error } = await supabase.rpc("get_friend_photo_comments", { p_photo_id: photoId });
  if (error) {
    console.error("SNS comments are unavailable", { code: error.code, message: error.message });
    throw new Error("コメントの取得に失敗しました");
  }
  return data ?? [];
}

export type SnsDayGroup = {
  photoDate: string;
  photos: SnsFeedPhotoRow[];
};

/** 日付ごとに新しい順で束ねる。同じ日の中は投稿順（古い順）のまま */
export function groupSnsFeedByDay(photos: SnsFeedPhotoRow[]): SnsDayGroup[] {
  const byDate = new Map<string, SnsFeedPhotoRow[]>();
  for (const photo of photos) {
    const list = byDate.get(photo.photo_date);
    if (list) list.push(photo);
    else byDate.set(photo.photo_date, [photo]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([photoDate, group]) => ({ photoDate, photos: group }));
}
