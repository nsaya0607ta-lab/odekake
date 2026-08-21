import { unstable_cache } from "next/cache";
import type { DB } from "./client";
import { signThumbOrOriginalPaths } from "./photos";
import type {
  FriendGroupMemberRow,
  FriendGroupMessageRow,
  FriendGroupRow,
  FriendGroupSummaryRow,
  SnsCommentRow,
  SnsFeedPhotoRow,
  SnsPhotoRow,
  SnsTextPostReplyRow,
  SnsTextPostRow,
} from "@/lib/supabase/types";

export type SnsLinkableVisit = {
  id: string;
  spotName: string;
  tripTitle: string;
  visitedAt: string;
};

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

/** SNS投稿へ任意で添えられる、自分自身の訪問記録。1件を選ぶだけで場所と旅行を一緒に紐づける。 */
export async function getSnsLinkableVisits(
  supabase: DB,
  userId: string,
  limit = 80,
): Promise<SnsLinkableVisit[]> {
  const { data: visits, error } = await supabase
    .from("visit_records")
    .select("id, visited_at, spot_id, trip_id, journey_id")
    .eq("user_id", userId)
    .order("visited_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("SNS linkable visits are unavailable", { code: error.code, message: error.message });
    return [];
  }
  if (!visits || visits.length === 0) return [];

  const spotIds = [...new Set(visits.map((visit) => visit.spot_id))];
  const tripIds = [...new Set(visits.map((visit) => visit.journey_id ?? visit.trip_id))];
  const [{ data: spots }, { data: trips }] = await Promise.all([
    supabase.from("spots").select("id, name").in("id", spotIds),
    supabase.from("trips").select("id, title").in("id", tripIds),
  ]);
  const spotNames = new Map((spots ?? []).map((spot) => [spot.id, spot.name]));
  const tripTitles = new Map((trips ?? []).map((trip) => [trip.id, trip.title]));

  return visits.flatMap((visit) => {
    const spotName = spotNames.get(visit.spot_id);
    if (!spotName) return [];
    const tripId = visit.journey_id ?? visit.trip_id;
    return [{
      id: visit.id,
      spotName,
      tripTitle: tripTitles.get(tripId) ?? "普段のおでかけ",
      visitedAt: visit.visited_at,
    }];
  });
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

/** 未読状態をキャッシュせず取得する。通知バッジなど即時性が必要な表示で使う。 */
export async function getMyFriendGroupsFresh(supabase: DB): Promise<FriendGroupRow[]> {
  return fetchMyFriendGroups(supabase);
}

/** グループ一覧用。最新投稿と正確な未読件数を1回のRPCでまとめて取得する。 */
export async function getMyFriendGroupSummaries(supabase: DB): Promise<FriendGroupSummaryRow[]> {
  const { data, error } = await supabase.rpc("get_my_friend_group_summaries");
  if (!error) return data ?? [];

  // 0058適用前でも一覧自体は利用できるよう、既存の軽いグループ取得へ戻す。
  if (error.code !== "PGRST202" && error.code !== "42883") {
    console.error("Friend group summaries are unavailable", { code: error.code, message: error.message });
  }
  const groups = await fetchMyFriendGroups(supabase);
  return groups.map((group) => ({
    ...group,
    unread_count: group.has_unread ? 1 : 0,
    latest_kind: null,
    latest_preview: null,
    latest_actor_name: null,
    latest_at: null,
  }));
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
