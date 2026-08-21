import Link from "next/link";
import { IconPlus, IconSend, IconUser } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import {
  matchesSnsFeedFilter,
  parseSnsFeedFilter,
  SnsFeedFilters,
} from "@/components/sns/sns-feed-filters";
import { SnsPrimaryNav } from "@/components/sns/sns-primary-nav";
import { SnsNotificationEntry } from "@/components/sns/sns-notification-button";
import { SnsTextFeed } from "@/components/sns/sns-text-feed";
import { signPhotoPaths, signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getMyFriendGroups, getOwnSnsProfile, getPersonalTextFeed } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "ホーム | SNS" };
export const dynamic = "force-dynamic";

/** グループに紐付かない、フレンド全員分のテキスト投稿（つぶやき）をまとめて見られるホーム画面 */
export default async function SnsHomePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const [{ supabase, user }, sp] = await Promise.all([requireUser(), searchParams]);

  const [posts, ownProfile, groups] = await Promise.all([
    getPersonalTextFeed(supabase),
    getOwnSnsProfile(supabase, user.id),
    getMyFriendGroups(supabase, user.id),
  ]);
  const filter = parseSnsFeedFilter(sp.filter);
  const visiblePosts = posts.filter((post) => matchesSnsFeedFilter(post, filter));
  const feedTitle = filter === "photos" ? "写真つきの投稿" : filter === "notes" ? "ひとこと投稿" : "新しいつぶやき";
  const allPhotoPaths = visiblePosts.flatMap((p) => p.photo_paths);
  const [avatarUrls, photoUrls, fullPhotoUrls] = await Promise.all([
    signThumbOrOriginalPaths(
      supabase,
      visiblePosts.flatMap((p) => (p.profile_image_url ? [p.profile_image_url] : [])),
    ),
    signThumbOrOriginalPaths(supabase, allPhotoPaths),
    signPhotoPaths(supabase, allPhotoPaths),
  ]);

  const groupHref = groups[0] ? `/sns/groups/${groups[0].id}` : "/sns/groups";

  return (
    <>
      <PageHeader
        title="SNS"
        subtitle="フレンドのおでかけが集まる場所"
        showBack={false}
        leftAction={<SnsNotificationEntry />}
      />
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody className="space-y-4">
        <SnsPrimaryNav active="home" userHref={`/sns/users/${user.id}`} groupHref={groupHref} />

        <section className="sns-home-welcome" aria-labelledby="sns-home-title">
          <span className="sns-home-sun" aria-hidden="true" />
          <span className="sns-home-sparkles" aria-hidden="true">✦　·　✧</span>
          <span className="sns-home-welcome-stamp" aria-hidden="true">TODAY</span>
          <p className="relative text-[10px] font-bold tracking-[0.18em] text-white/75">FRIENDS TIMELINE</p>
          <h2 id="sns-home-title" className="relative mt-0.5 text-xl font-bold text-white">みんなのおでかけ</h2>
          <p className="relative mt-1 max-w-[16rem] text-xs leading-relaxed text-white/80">
            フレンドのつぶやきや写真を、ここでまとめて楽しめます。
          </p>
        </section>

        <Link href="/sns/home/new" className="sns-quick-compose pressable" aria-label="新しいつぶやきを投稿">
          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-card bg-leaf-soft shadow-sm">
            {ownProfile.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ownProfile.iconUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-leaf-deep">
                <IconUser size={20} />
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">いま、どこにいる？</span>
            <span className="block truncate text-[11px] text-ink-faint">写真やひとことをフレンドに共有</span>
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf text-white shadow-sm">
            <IconSend size={16} />
          </span>
        </Link>

        <div className="flex items-end justify-between gap-3 px-1 pt-1">
          <div>
            <p className="text-[10px] font-bold tracking-[0.16em] text-apricot">LATEST</p>
            <h2 className="text-base font-bold">{feedTitle}</h2>
          </div>
          <span className="rounded-full bg-card/80 px-2.5 py-1 text-[10px] font-bold text-ink-faint shadow-sm ring-1 ring-line">
            {visiblePosts.length}件
          </span>
        </div>

        <SnsFeedFilters active={filter} baseHref="/sns/home" />

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
      <Link
        href="/sns/home/new"
        aria-label="投稿する"
        className="sns-floating-compose fixed right-4 z-30 flex h-14 items-center justify-center gap-1.5 rounded-full px-4 text-white shadow-lg active:opacity-80"
        style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 1rem)" }}
      >
        <IconPlus size={21} />
        <span className="text-sm font-bold">投稿</span>
      </Link>
    </>
  );
}
