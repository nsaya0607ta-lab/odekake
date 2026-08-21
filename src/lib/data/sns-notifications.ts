import { cache } from "react";
import type { DB } from "./client";
import { signThumbOrOriginalPaths } from "./photos";
import {
  getFriendTextPostReplies,
  getMyFriendGroupsFresh,
  getPersonalTextFeed,
  getSnsMentions,
} from "./sns";
import type { FriendGroupRow, SnsMentionNotificationRow, SnsTextPostRow } from "@/lib/supabase/types";

const POST_LIMIT = 50;
const REPLY_POST_LIMIT = 20;

export const SNS_NOTIFICATION_SEEN_AT_KEY = "sns_notifications_seen_at";
export const SNS_NOTIFICATION_LIKE_COUNTS_KEY = "sns_notification_like_counts";
export const SNS_NOTIFICATION_PREFERENCES_KEY = "sns_notification_preferences";
export const SNS_MUTED_GROUP_IDS_KEY = "sns_muted_group_ids";

export type SnsNotificationKind = "reply" | "like" | "mention" | "group";

export type SnsNotificationPreferences = {
  replies: boolean;
  likes: boolean;
  mentions: boolean;
  groups: boolean;
  mutedGroupIds: string[];
};

export const DEFAULT_SNS_NOTIFICATION_PREFERENCES: SnsNotificationPreferences = {
  replies: true,
  likes: true,
  mentions: true,
  groups: true,
  mutedGroupIds: [],
};

export type SnsNotificationItem = {
  id: string;
  kind: SnsNotificationKind;
  href: string;
  title: string;
  body: string;
  createdAt: string | null;
  avatarUrl?: string;
  isUnread: boolean;
  unreadAmount: number;
  countLabel?: string;
};

export type SnsNotificationCenter = {
  items: SnsNotificationItem[];
  unreadCount: number;
};

type NotificationReadState = {
  seenAt: string | null;
  likeCounts: Record<string, number>;
};

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function parseLikeCounts(value: unknown): Record<string, number> {
  const source = recordOf(value);
  const counts: Record<string, number> = {};
  for (const [postId, count] of Object.entries(source)) {
    if (typeof count === "number" && Number.isFinite(count) && count >= 0) counts[postId] = count;
  }
  return counts;
}

async function getNotificationReadState(supabase: DB): Promise<NotificationReadState> {
  const { data } = await supabase.auth.getClaims();
  const claims = recordOf(data?.claims);
  const metadata = recordOf(claims.user_metadata);
  const rawSeenAt = metadata[SNS_NOTIFICATION_SEEN_AT_KEY];

  return {
    seenAt: typeof rawSeenAt === "string" && !Number.isNaN(Date.parse(rawSeenAt)) ? rawSeenAt : null,
    likeCounts: parseLikeCounts(metadata[SNS_NOTIFICATION_LIKE_COUNTS_KEY]),
  };
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export async function getSnsNotificationPreferences(supabase: DB): Promise<SnsNotificationPreferences> {
  const { data } = await supabase.auth.getClaims();
  const claims = recordOf(data?.claims);
  const metadata = recordOf(claims.user_metadata);
  const raw = recordOf(metadata[SNS_NOTIFICATION_PREFERENCES_KEY]);
  const muted = metadata[SNS_MUTED_GROUP_IDS_KEY];

  return {
    replies: parseBoolean(raw.replies, true),
    likes: parseBoolean(raw.likes, true),
    mentions: parseBoolean(raw.mentions, true),
    groups: parseBoolean(raw.groups, true),
    mutedGroupIds: Array.isArray(muted)
      ? muted.filter((id): id is string => typeof id === "string")
      : [],
  };
}

function ownLikeCount(post: SnsTextPostRow): number {
  return Math.max(0, Number(post.like_count) - (post.my_liked ? 1 : 0));
}

function postPreview(post: SnsTextPostRow): string {
  const body = post.body.trim();
  if (body) return body;
  return post.photo_paths.length > 0 ? "写真つきの投稿" : "投稿";
}

async function getNotificationSources(
  supabase: DB,
  userId: string,
): Promise<{
  ownPosts: SnsTextPostRow[];
  groups: FriendGroupRow[];
  readState: NotificationReadState;
  mentions: SnsMentionNotificationRow[];
  preferences: SnsNotificationPreferences;
}> {
  const [ownPosts, groups, readState, mentions, preferences] = await Promise.all([
    getPersonalTextFeed(supabase, userId, POST_LIMIT).catch(() => []),
    getMyFriendGroupsFresh(supabase).catch(() => []),
    getNotificationReadState(supabase),
    getSnsMentions(supabase).catch(() => []),
    getSnsNotificationPreferences(supabase),
  ]);
  return { ownPosts, groups, readState, mentions, preferences };
}

/** 返信・投稿いいね・グループ未読を、追加テーブルなしで1つの一覧にまとめる。 */
export async function getSnsNotificationCenter(supabase: DB, userId: string): Promise<SnsNotificationCenter> {
  const { ownPosts, groups, readState, mentions, preferences } = await getNotificationSources(supabase, userId);
  const seenAtMs = readState.seenAt ? Date.parse(readState.seenAt) : 0;
  const replyPosts = ownPosts.filter((post) => post.reply_count > 0).slice(0, REPLY_POST_LIMIT);
  const replyLists = await Promise.all(
    replyPosts.map((post) => getFriendTextPostReplies(supabase, post.id).catch(() => [])),
  );

  const replyRows = replyPosts.flatMap((post, index) =>
    (replyLists[index] ?? [])
      .filter((reply) => reply.user_id !== userId)
      .map((reply) => ({ post, reply })),
  );
  const avatarUrls = await signThumbOrOriginalPaths(
    supabase,
    [
      ...replyRows.flatMap(({ reply }) => (reply.profile_image_url ? [reply.profile_image_url] : [])),
      ...mentions.flatMap((mention) =>
        mention.actor_profile_image_url ? [mention.actor_profile_image_url] : [],
      ),
    ],
  ).catch(() => new Map<string, string>());

  const replyItems: SnsNotificationItem[] = preferences.replies ? replyRows.map(({ post, reply }) => {
    const isUnread = Date.parse(reply.created_at) > seenAtMs;
    return {
      id: `reply:${reply.id}`,
      kind: "reply",
      href: `/sns/posts/${post.id}`,
      title: `${reply.display_name}さんが返信しました`,
      body: reply.body,
      createdAt: reply.created_at,
      avatarUrl: reply.profile_image_url ? avatarUrls.get(reply.profile_image_url) : undefined,
      isUnread,
      unreadAmount: isUnread ? 1 : 0,
    };
  }) : [];

  const likeItems: SnsNotificationItem[] = preferences.likes ? ownPosts.flatMap((post) => {
    const total = ownLikeCount(post);
    if (total === 0) return [];
    const previous = readState.likeCounts[post.id] ?? 0;
    const unreadAmount = Math.max(0, total - previous);
    return [{
      id: `like:${post.id}`,
      kind: "like" as const,
      href: `/sns/posts/${post.id}`,
      title: "あなたの投稿にいいね",
      body: postPreview(post),
      createdAt: null,
      isUnread: unreadAmount > 0,
      unreadAmount,
      countLabel: unreadAmount > 0 ? `新着 +${unreadAmount}` : `合計 ${total}件`,
    }];
  }) : [];

  const replyNotificationIds = new Set(replyItems.map((item) => item.id));
  const mentionItems: SnsNotificationItem[] = preferences.mentions ? mentions.flatMap((mention) => {
    if (replyNotificationIds.has(mention.id)) return [];
    const isUnread = Date.parse(mention.created_at) > seenAtMs;
    const href = mention.group_id
      ? `/sns/groups/${mention.group_id}?view=chat`
      : mention.post_id
        ? `/sns/posts/${mention.post_id}`
        : "/sns/home";
    return [{
      id: `mention:${mention.id}`,
      kind: "mention" as const,
      href,
      title: `${mention.actor_display_name}さんがあなたをメンションしました`,
      body: mention.body,
      createdAt: mention.created_at,
      avatarUrl: mention.actor_profile_image_url
        ? avatarUrls.get(mention.actor_profile_image_url)
        : undefined,
      isUnread,
      unreadAmount: isUnread ? 1 : 0,
    }];
  }) : [];

  const mutedGroupIds = new Set(preferences.mutedGroupIds);
  const groupItems: SnsNotificationItem[] = preferences.groups ? groups.flatMap((group) =>
    group.has_unread && !mutedGroupIds.has(group.id)
      ? [{
          id: `group:${group.id}`,
          kind: "group" as const,
          href: `/sns/groups/${group.id}`,
          title: group.name,
          body: "新しい写真またはメッセージがあります",
          createdAt: null,
          isUnread: true,
          unreadAmount: 1,
          countLabel: "新着あり",
        }]
      : [],
  ) : [];

  const items = [...replyItems, ...mentionItems, ...likeItems, ...groupItems].sort((a, b) => {
    if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1;
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });

  return {
    items,
    unreadCount: items.reduce((sum, item) => sum + item.unreadAmount, 0),
  };
}

/** ヘッダーのバッジ用。署名付きアバターURLを作らず、未読数だけを計算する。 */
export const getSnsUnreadCount = cache(async function getSnsUnreadCount(
  supabase: DB,
  userId: string,
): Promise<number> {
  const { ownPosts, groups, readState, mentions, preferences } = await getNotificationSources(supabase, userId);
  const seenAtMs = readState.seenAt ? Date.parse(readState.seenAt) : 0;
  const replyPosts = ownPosts.filter((post) => post.reply_count > 0).slice(0, REPLY_POST_LIMIT);
  const replyLists = await Promise.all(
    replyPosts.map((post) => getFriendTextPostReplies(supabase, post.id).catch(() => [])),
  );
  const unreadReplies = preferences.replies ? replyLists.reduce(
    (sum, replies) =>
      sum + replies.filter((reply) => reply.user_id !== userId && Date.parse(reply.created_at) > seenAtMs).length,
    0,
  ) : 0;
  const unreadLikes = preferences.likes ? ownPosts.reduce((sum, post) => {
    const current = ownLikeCount(post);
    return sum + Math.max(0, current - (readState.likeCounts[post.id] ?? 0));
  }, 0) : 0;
  const replyNotificationIds = preferences.replies
    ? new Set(replyLists.flatMap((replies) => replies.map((reply) => `reply:${reply.id}`)))
    : new Set<string>();
  const unreadMentions = preferences.mentions
    ? mentions.filter(
        (mention) => !replyNotificationIds.has(mention.id) && Date.parse(mention.created_at) > seenAtMs,
      ).length
    : 0;
  const mutedGroupIds = new Set(preferences.mutedGroupIds);
  const unreadGroups = preferences.groups
    ? groups.filter((group) => group.has_unread && !mutedGroupIds.has(group.id)).length
    : 0;
  return unreadReplies + unreadMentions + unreadLikes + unreadGroups;
});

export async function getSnsNotificationReadSnapshot(
  supabase: DB,
  userId: string,
): Promise<{ likeCounts: Record<string, number>; unreadGroupIds: string[] }> {
  const [ownPosts, groups] = await Promise.all([
    getPersonalTextFeed(supabase, userId, POST_LIMIT).catch(() => []),
    getMyFriendGroupsFresh(supabase).catch(() => []),
  ]);
  const likeCounts: Record<string, number> = {};
  for (const post of ownPosts) {
    const count = ownLikeCount(post);
    if (count > 0) likeCounts[post.id] = count;
  }

  return {
    likeCounts,
    unreadGroupIds: groups.filter((group) => group.has_unread).map((group) => group.id),
  };
}
