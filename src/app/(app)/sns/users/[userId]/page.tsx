import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconPlus, IconSearch, IconUser } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsPeopleRail, type SnsPersonRow } from "@/components/sns/sns-people-rail";
import { SnsNotificationEntry } from "@/components/sns/sns-notification-button";
import { SnsPrimaryNav } from "@/components/sns/sns-primary-nav";
import { parseSnsProfileTab, SnsProfileTabs } from "@/components/sns/sns-profile-tabs";
import { SnsTextFeed } from "@/components/sns/sns-text-feed";
import { getFriendList } from "@/lib/data/friends";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import {
  getFriendProfile,
  getOwnSnsProfile,
  getPersonalTextFeed,
  getSavedFriendTextPosts,
  getSnsHiddenUserIds,
  getSnsTextPostAvatarPaths,
  getSnsTextPostPhotoPaths,
} from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const INITIAL_USER_POST_LIMIT = 24;
const USER_POST_LIMIT_STEP = 24;
const MAX_USER_POST_LIMIT = 120;

/** 特定ユーザーの個人投稿画面。グループとは無関係に、そのユーザー自身のつぶやきだけを一覧できる */
export default async function SnsUserHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string; limit?: string }>;
}) {
  const [{ userId }, sp, { supabase, user }] = await Promise.all([params, searchParams, requireUser()]);

  const isMine = userId === user.id;
  const tab = parseSnsProfileTab(sp.tab, isMine);
  const requestedLimit = Number.parseInt(sp.limit ?? "", 10);
  const postLimit = Number.isFinite(requestedLimit)
    ? Math.min(MAX_USER_POST_LIMIT, Math.max(INITIAL_USER_POST_LIMIT, requestedLimit))
    : INITIAL_USER_POST_LIMIT;
  const [profile, fetchedPosts, allFriends, ownProfile, fetchedSavedPosts, hiddenUserIds] = await Promise.all([
    getFriendProfile(supabase, userId),
    getPersonalTextFeed(supabase, userId, postLimit + 1),
    getFriendList(supabase),
    getOwnSnsProfile(supabase, user.id),
    isMine && tab === "saved"
      ? getSavedFriendTextPosts(supabase, postLimit + 1)
      : Promise.resolve([]),
    getSnsHiddenUserIds(supabase),
  ]);
  if (!isMine && hiddenUserIds.has(userId)) notFound();
  const friends = allFriends.filter((friend) => !hiddenUserIds.has(friend.friend_user_id));
  const hasMorePosts = fetchedPosts.length > postLimit;
  const hasMoreSavedPosts = fetchedSavedPosts.length > postLimit;
  const posts = fetchedPosts.slice(0, postLimit);
  const savedPosts = fetchedSavedPosts.slice(0, postLimit);
  const ownPosts = [...posts].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));
  const visiblePosts = tab === "saved"
    ? savedPosts
    : tab === "photos"
      ? ownPosts.filter((post) => post.photo_paths.length > 0 || post.quoted_photo_paths.length > 0)
      : tab === "places"
        ? ownPosts.filter((post) => post.linked_spot_id || post.quoted_linked_spot_id)
        : ownPosts;
  const allPhotoPaths = getSnsTextPostPhotoPaths(visiblePosts);
  const [avatarUrls, photoUrls, friendAvatarUrls] = await Promise.all([
    signThumbOrOriginalPaths(supabase, getSnsTextPostAvatarPaths(visiblePosts)),
    signThumbOrOriginalPaths(supabase, allPhotoPaths),
    signThumbOrOriginalPaths(
      supabase,
      friends.flatMap((friend) => (friend.profile_image_url ? [friend.profile_image_url] : [])),
    ),
  ]);

  const people: SnsPersonRow[] = [
    { id: user.id, label: ownProfile.displayName, iconUrl: ownProfile.iconUrl, isMe: true },
    ...friends.map((friend) => ({
      id: friend.friend_user_id,
      label: friend.display_name,
      iconUrl: friend.profile_image_url ? friendAvatarUrls.get(friend.profile_image_url) : undefined,
    })),
  ];
  const loadedPhotoCount = posts.filter(
    (post) => post.photo_paths.length > 0 || post.quoted_photo_paths.length > 0,
  ).length;
  const loadedPlaceCount = posts.filter(
    (post) => post.linked_spot_id || post.quoted_linked_spot_id,
  ).length;
  const counts: Partial<Record<"posts" | "photos" | "places" | "saved", number | string>> = {
    posts: hasMorePosts ? `${posts.length}+` : posts.length,
    photos: hasMorePosts && loadedPhotoCount === 0
      ? undefined
      : hasMorePosts ? `${loadedPhotoCount}+` : loadedPhotoCount,
    places: hasMorePosts && loadedPlaceCount === 0
      ? undefined
      : hasMorePosts ? `${loadedPlaceCount}+` : loadedPlaceCount,
    saved: tab === "saved"
      ? (hasMoreSavedPosts ? `${savedPosts.length}+` : savedPosts.length)
      : undefined,
  };
  const hasMoreVisiblePosts = tab === "saved" ? hasMoreSavedPosts : hasMorePosts;
  const moreParams = new URLSearchParams({
    ...(tab === "posts" ? {} : { tab }),
    limit: String(Math.min(MAX_USER_POST_LIMIT, postLimit + USER_POST_LIMIT_STEP)),
  });

  return (
    <>
      <PageHeader
        title="SNS"
        subtitle="ユーザーのつぶやき"
        showBack={false}
        leftAction={<SnsNotificationEntry />}
        action={(
          <Link href="/sns/search" prefetch={false} aria-label="SNSを検索" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft active:bg-paper-deep">
            <IconSearch size={20} />
          </Link>
        )}
      />
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody className="sns-page-shell space-y-3">
        <SnsPrimaryNav active="user" userHref={`/sns/users/${user.id}`} groupHref="/sns/groups" />
        <SnsPeopleRail people={people} activeUserId={userId} />

        <section className="sns-profile-hero is-compact">
          <span className="sns-profile-orbit" aria-hidden="true" />
          <span className="sns-profile-avatar">
            {profile.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.iconUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <IconUser size={34} className="text-leaf-deep" />
            )}
          </span>
          <div className="relative min-w-0 flex-1">
            <h1 className="truncate text-lg font-black">{profile.displayName}</h1>
            <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-ink-faint">
              <span>つぶやき {hasMorePosts ? `${posts.length}+` : posts.length}</span>
              {isMine ? <span className="sns-profile-me-chip">あなた</span> : null}
            </div>
          </div>
          <span className="sns-profile-role-art" aria-hidden="true">
            <Image
              src="/illustrations/sns/nav-user-v2.webp"
              alt=""
              width={64}
              height={64}
              sizes="64px"
            />
          </span>
          {isMine ? (
            <Link
              href="/sns/home/new"
              data-haptic="light"
              aria-label="つぶやく"
              className="sns-profile-compose pressable relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-white"
            >
              <IconPlus size={20} />
            </Link>
          ) : null}
        </section>

        <SnsProfileTabs
          active={tab}
          baseHref={`/sns/users/${userId}`}
          isMine={isMine}
          counts={counts}
        />

        {tab === "saved" ? (
          <section className="sns-saved-mini-hero">
            <Image src="/illustrations/sns/saved-journey-v2.webp" alt="" width={90} height={90} sizes="90px" />
            <span>
              <strong>あとで行きたい場所をここに</strong>
              <small>投稿の保存ボタンから、いつでも見返せます。</small>
            </span>
          </section>
        ) : null}

        <SnsTextFeed
          posts={visiblePosts}
          avatarUrls={avatarUrls}
          photoUrls={photoUrls}
          currentUserId={user.id}
          emptyTitle={
            tab === "saved"
              ? "保存した投稿はまだありません"
              : tab === "photos"
                ? "写真つきの投稿はまだありません"
                : tab === "places"
                  ? "場所つきの投稿はまだありません"
                  : undefined
          }
          emptyMessage={tab === "saved" ? "気になる投稿の保存ボタンを押してみましょう。" : undefined}
        />
        {hasMoreVisiblePosts && postLimit < MAX_USER_POST_LIMIT ? (
          <Link
            href={`/sns/users/${userId}?${moreParams.toString()}`}
            prefetch={false}
            scroll={false}
            className="sns-feed-more pressable"
          >
            以前の投稿をもっと見る
          </Link>
        ) : null}
      </PageBody>
    </>
  );
}
