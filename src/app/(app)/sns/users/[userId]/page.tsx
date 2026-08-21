import Image from "next/image";
import Link from "next/link";
import { IconPlus, IconUser } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import {
  matchesSnsFeedFilter,
  parseSnsFeedFilter,
  SnsFeedFilters,
} from "@/components/sns/sns-feed-filters";
import { SnsPeopleRail, type SnsPersonRow } from "@/components/sns/sns-people-rail";
import { SnsNotificationEntry } from "@/components/sns/sns-notification-button";
import { SnsPrimaryNav } from "@/components/sns/sns-primary-nav";
import { SnsTextFeed } from "@/components/sns/sns-text-feed";
import { getFriendList } from "@/lib/data/friends";
import { signPhotoPaths, signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getFriendProfile, getOwnSnsProfile, getPersonalTextFeed } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** 特定ユーザーの個人投稿画面。グループとは無関係に、そのユーザー自身のつぶやきだけを一覧できる */
export default async function SnsUserHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const [{ userId }, sp, { supabase, user }] = await Promise.all([params, searchParams, requireUser()]);

  const [profile, posts, friends, ownProfile] = await Promise.all([
    getFriendProfile(supabase, userId),
    getPersonalTextFeed(supabase, userId),
    getFriendList(supabase),
    getOwnSnsProfile(supabase, user.id),
  ]);
  const filter = parseSnsFeedFilter(sp.filter);
  const visiblePosts = posts.filter((post) => matchesSnsFeedFilter(post, filter));
  const allPhotoPaths = visiblePosts.flatMap((p) => p.photo_paths);
  const [avatarUrls, photoUrls, fullPhotoUrls, friendAvatarUrls] = await Promise.all([
    signThumbOrOriginalPaths(
      supabase,
      visiblePosts.flatMap((p) => (p.profile_image_url ? [p.profile_image_url] : [])),
    ),
    signThumbOrOriginalPaths(supabase, allPhotoPaths),
    signPhotoPaths(supabase, allPhotoPaths),
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
  const isMine = userId === user.id;

  return (
    <>
      <PageHeader
        title="SNS"
        subtitle="ユーザーのつぶやき"
        showBack={false}
        leftAction={<SnsNotificationEntry />}
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

        <SnsFeedFilters active={filter} baseHref={`/sns/users/${userId}`} />

        <SnsTextFeed
          posts={visiblePosts}
          avatarUrls={avatarUrls}
          photoUrls={photoUrls}
          fullPhotoUrls={fullPhotoUrls}
          currentUserId={user.id}
          emptyTitle={
            filter === "photos"
              ? "写真つきの投稿はまだありません"
              : filter === "notes"
                ? "ひとこと投稿はまだありません"
                : undefined
          }
          emptyMessage={filter === "all" ? undefined : "ほかの種類に切り替えると投稿を見られます。"}
        />
      </PageBody>
    </>
  );
}
