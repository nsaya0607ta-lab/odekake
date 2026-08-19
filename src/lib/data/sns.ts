import type { DB } from "./client";
import type { SnsCommentRow, SnsFeedPhotoRow } from "@/lib/supabase/types";

/** フィードで遡って表示する日数 */
export const SNS_FEED_DAYS = 30;

export async function getSnsFeed(supabase: DB, days: number = SNS_FEED_DAYS): Promise<SnsFeedPhotoRow[]> {
  const { data, error } = await supabase.rpc("get_sns_feed", { p_days: days });
  if (error) {
    console.error("SNS feed is unavailable", { code: error.code, message: error.message });
    throw new Error("SNS写真の取得に失敗しました");
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
