import Image from "next/image";
import Link from "next/link";
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
  getSnsTextPostAvatarPaths,
  getSnsTextPostPhotoPaths,
} from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** 特定ユーザーの個人投稿画面。グループとは無関係に、そのユーザー自身のつぶやきだけを一覧できる */
export default async function SnsUserHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ userId }, sp, { supabase, user }] = await Promise.all([params, searchParams, requireUser()]);

  const isMine = userId === user.id;
  const [profile, posts, friends, ownProfile, savedPosts] = await Promise.all([
    getFriendProfile(supabase, userId),
    getPersonalTextFeed(supabase, userId),
    getFriendList(supabase),
    getOwnSnsProfile(supabase, user.id),
    isMine ? getSavedFriendTextPosts(supabase) : Promise.resolve([]),
  ]);
  const tab = parseSnsProfileTab(sp.tab, isMine);
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
  const counts = {
    posts: posts.length,
    photos: posts.filter((post) => post.photo_paths.length > 0 || post.quoted_photo_paths.length > 0).length,
    places: posts.filter((post) => post.linked_spot_id || post.quoted_linked_spot_id).length,
    saved: savedPosts.length,
  };

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
              <span>つぶやき {posts.length}</span>
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
      </PageBody>
    </>
  );
}
