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
  const feedTitle = filter === "photos" ? "写真つきの投稿" : filter === "notes" ? "ひとこと投稿" : "つぶやき";
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
      <PageBody className="space-y-4">
        <SnsPrimaryNav active="user" userHref={`/sns/users/${user.id}`} groupHref="/sns/groups" />
        <SnsPeopleRail people={people} activeUserId={userId} />

        <section className="sns-profile-hero">
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
            <p className="text-[10px] font-bold tracking-[0.16em] text-leaf-deep">PERSONAL NOTE</p>
            <h1 className="truncate text-xl font-bold">{profile.displayName}</h1>
            <p className="mt-1 text-xs text-ink-soft">おでかけのひとことと写真</p>
            <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-ink-faint">
              <span className="rounded-full bg-card/75 px-2.5 py-1 ring-1 ring-line">つぶやき {posts.length}</span>
              {isMine ? <span className="rounded-full bg-leaf-soft px-2.5 py-1 text-leaf-deep">あなたのページ</span> : null}
            </div>
          </div>
          {isMine ? (
            <Link
              href="/sns/home/new"
              aria-label="つぶやく"
              className="pressable relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-leaf text-white shadow-md"
            >
              <IconPlus size={20} />
            </Link>
          ) : null}
        </section>

        <div className="flex items-end justify-between gap-3 px-1 pt-1">
          <div>
            <p className="text-[10px] font-bold tracking-[0.16em] text-apricot">POSTS</p>
            <h2 className="text-base font-bold">{feedTitle}</h2>
          </div>
        </div>

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
