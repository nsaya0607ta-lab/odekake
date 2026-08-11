import type { DB } from "./client";
import type {
  FriendCollectionRow,
  FriendListRow,
  FriendOverviewRow,
  FriendPrefectureRow,
  FriendPrivacySettingsRow,
  FriendRecentVisitRow,
} from "@/lib/supabase/types";

type DataError = { code?: string; message?: string; details?: string; hint?: string };

const FRIENDS_UNAVAILABLE_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);
const FRIENDS_SCHEMA_VERSION = 2;

export type FriendsSetupStatus =
  | { ready: true; version: number }
  | { ready: false; reason: "migration_required" | "outdated_migration" };

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
  console.error(`[friends/data] ${context}`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
  if (error?.code && FRIENDS_UNAVAILABLE_CODES.has(error.code)) {
    throw new FriendsUnavailableError();
  }
  throw new Error(context);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * フレンド機能だけのDB準備状態を確認する。
 * AuthやVercel環境変数の変更はせず、専用RPCの有無とバージョンだけを見る。
 */
export async function getFriendsSetupStatus(supabase: DB): Promise<FriendsSetupStatus> {
  const { data, error } = await supabase.rpc("get_friends_health");

  if (error) {
    console.error("[friends/health] Database health check failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    if (error.code && FRIENDS_UNAVAILABLE_CODES.has(error.code)) {
      return { ready: false, reason: "migration_required" };
    }
    throwDataError(error, "Friend database health check failed");
  }

  if (!isRecord(data) || data.ready !== true || typeof data.version !== "number") {
    return { ready: false, reason: "outdated_migration" };
  }

  if (data.version < FRIENDS_SCHEMA_VERSION) {
    return { ready: false, reason: "outdated_migration" };
  }

  return { ready: true, version: data.version };
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
