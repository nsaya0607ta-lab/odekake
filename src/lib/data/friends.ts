import type { DB } from "./client";
import type {
  FriendCollectionRow,
  FriendListRow,
  FriendOverviewRow,
  FriendPrefectureRow,
  FriendPrivacySettingsRow,
  FriendRecentVisitRow,
} from "@/lib/supabase/types";

type DataError = { code?: string; message?: string };

const FRIENDS_UNAVAILABLE_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

export class FriendsUnavailableError extends Error {
  constructor() {
    super("フレンド機能を準備中です");
    this.name = "FriendsUnavailableError";
  }
}
export function isFriendsUnavailableError(error: unknown): error is FriendsUnavailableError {
  return error instanceof FriendsUnavailableError;
}

function throwDataError(error: DataError | null, context: string): never {
  if (error?.code && FRIENDS_UNAVAILABLE_CODES.has(error.code)) {
    throw new FriendsUnavailableError();
  }
  console.error(context, { code: error?.code, message: error?.message });
  throw new Error(context);
}

export function formatFriendCode(code: string): string {
  const normalized = code.toUpperCase().replace(/[\s-]/g, "").slice(0, 8);
  return normalized.length > 4 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : normalized;
}

export async function getMyFriendCode(supabase: DB): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_friend_code");
  if (error || !data) throwDataError(error, "Friend code is unavailable");
  return data;
}

export async function getFriendList(supabase: DB): Promise<FriendListRow[]> {
  const { data, error } = await supabase.rpc("get_friend_list");
  if (error) throwDataError(error, "Friend list is unavailable");
  return data ?? [];
}

export async function getFriendOverview(
  supabase: DB,
  friendUserId: string,
): Promise<FriendOverviewRow | null> {
  const { data, error } = await supabase.rpc("get_friend_overview", {
    p_friend_user_id: friendUserId,
  });
  if (error) throwDataError(error, "Friend overview is unavailable");
  return data?.[0] ?? null;
}

export async function getFriendPrefectures(
  supabase: DB,
  friendUserId: string,
): Promise<FriendPrefectureRow[]> {
  const { data, error } = await supabase.rpc("get_friend_prefectures", {
    p_friend_user_id: friendUserId,
  });
  if (error) throwDataError(error, "Friend prefectures are unavailable");
  return data ?? [];
}

export async function getFriendCollection(
  supabase: DB,
  friendUserId: string,
): Promise<FriendCollectionRow[]> {
  const { data, error } = await supabase.rpc("get_friend_collection", {
    p_friend_user_id: friendUserId,
  });
  if (error) throwDataError(error, "Friend collection is unavailable");
  return data ?? [];
}

export async function getFriendRecentVisits(
  supabase: DB,
  friendUserId: string,
  limit = 5,
): Promise<FriendRecentVisitRow[]> {
  const { data, error } = await supabase.rpc("get_friend_recent_visits", {
    p_friend_user_id: friendUserId,
    p_limit: limit,
  });
  if (error) throwDataError(error, "Friend visits are unavailable");
  return data ?? [];
}

export async function getFriendPrivacySettings(
  supabase: DB,
  userId: string,
): Promise<FriendPrivacySettingsRow> {
  const { data, error } = await supabase
    .from("friend_privacy_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throwDataError(error, "Friend privacy settings are unavailable");
  return (
    data ?? {
      user_id: userId,
      show_prefectures: true,
      show_collection: true,
      show_recent_visits: true,
      updated_at: new Date(0).toISOString(),
    }
  );
}
