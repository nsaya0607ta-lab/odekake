import Link from "next/link";
import { IconPlus } from "@/components/icons";
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
import { getPersonalTextFeed } from "@/lib/data/sns";
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

  const posts = await getPersonalTextFeed(supabase);
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
        <SnsPrimaryNav active="home" userHref={`/sns/users/${user.id}`} groupHref="/sns/groups" />

        <section className="sns-home-welcome is-compact" aria-labelledby="sns-home-title">
          <span className="sns-home-sun" aria-hidden="true" />
          <span className="sns-home-welcome-stamp" aria-hidden="true">TODAY</span>
          <p className="relative text-[10px] font-bold tracking-[0.18em] text-white/75">FRIENDS TIMELINE</p>
          <span className="relative mt-0.5 flex items-center gap-2">
            <h2 id="sns-home-title" className="text-lg font-black text-white">みんなのおでかけ</h2>
            <span className="sns-home-count">{visiblePosts.length}件</span>
          </span>
          <p className="relative mt-0.5 text-[10px] font-semibold text-white/75">{feedTitle}</p>
        </section>

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
