import type { DB } from "./client";
import type { NoticeDetailRow, NoticeFeedRow } from "@/lib/supabase/types";

const NOTICES_UNAVAILABLE_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

/** お知らせ機能未セットアップ（マイグレーション未適用）のDBでは静かに空を返す。 */
function isUnavailable(error: { code?: string } | null): boolean {
  return !!error?.code && NOTICES_UNAVAILABLE_CODES.has(error.code);
}

export async function getNoticesFeed(supabase: DB, limit = 20): Promise<NoticeFeedRow[]> {
  const { data, error } = await supabase.rpc("get_notices_feed", { p_limit: limit });
  if (error) {
    if (isUnavailable(error)) return [];
    console.error("Notices feed is unavailable", { code: error.code, message: error.message });
    throw new Error("Notices feed is unavailable");
  }
  return data ?? [];
}

export async function getNoticeDetail(supabase: DB, noticeId: string): Promise<NoticeDetailRow | null> {
  const { data, error } = await supabase.rpc("get_notice_detail", { p_notice_id: noticeId });
  if (error) {
    if (isUnavailable(error)) return null;
    console.error("Notice detail is unavailable", { code: error.code, message: error.message });
    throw new Error("Notice detail is unavailable");
  }
  return data?.[0] ?? null;
}

export async function getUnreadNoticeCount(supabase: DB): Promise<number> {
  const { data, error } = await supabase.rpc("get_unread_notice_count");
  if (error) {
    if (isUnavailable(error)) return 0;
    console.error("Unread notice count is unavailable", { code: error.code, message: error.message });
    throw new Error("Unread notice count is unavailable");
  }
  return data ?? 0;
}

export async function markNoticesRead(supabase: DB, noticeIds: string[]): Promise<void> {
  if (noticeIds.length === 0) return;
  const { error } = await supabase.rpc("mark_notices_read", { p_notice_ids: noticeIds });
  if (error && !isUnavailable(error)) {
    console.error("Failed to mark notices read", { code: error.code, message: error.message });
  }
}

export async function isNoticeAdmin(supabase: DB): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_notice_admin");
  if (error) {
    if (isUnavailable(error)) return false;
    console.error("Admin check is unavailable", { code: error.code, message: error.message });
    return false;
  }
  return data ?? false;
}

export async function postAdminNotice(
  supabase: DB,
  title: string,
  message: string,
  imagePath: string | null = null,
): Promise<string> {
  const { data, error } = await supabase.rpc("post_admin_notice", {
    p_title: title,
    p_message: message,
    p_image_path: imagePath,
  });
  if (error) throw new Error(error.message || "お知らせの投稿に失敗しました");
  return data;
}

export async function updateAdminNotice(
  supabase: DB,
  noticeId: string,
  title: string,
  message: string,
  imagePath: string | null = null,
): Promise<void> {
  const { error } = await supabase.rpc("update_admin_notice", {
    p_notice_id: noticeId,
    p_title: title,
    p_message: message,
    p_image_path: imagePath,
  });
  if (error) throw new Error(error.message || "お知らせを更新できませんでした");
}

/** 削除したお知らせに添付されていた画像のパスを返す（Storageの後片付け用、無ければnull） */
export async function deleteAdminNotice(supabase: DB, noticeId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("delete_admin_notice", { p_notice_id: noticeId });
  if (error) throw new Error(error.message || "お知らせを削除できませんでした");
  return data ?? null;
}
