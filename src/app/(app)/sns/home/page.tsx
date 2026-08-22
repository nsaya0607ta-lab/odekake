import Image from "next/image";
import Link from "next/link";
import { IconPlus, IconSearch } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import {
  matchesSnsFeedFilter,
  parseSnsFeedFilter,
  SnsFeedFilters,
} from "@/components/sns/sns-feed-filters";
import { SnsGuideStrip } from "@/components/sns/sns-guide-card";
import { SnsPrimaryNav } from "@/components/sns/sns-primary-nav";
import { SnsNotificationEntry } from "@/components/sns/sns-notification-button";
import { SnsTextFeed } from "@/components/sns/sns-text-feed";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import {
  getPersonalTextFeed,
  getSnsTextPostAvatarPaths,
  getSnsTextPostPhotoPaths,
} from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "ホーム | SNS" };
export const dynamic = "force-dynamic";

const INITIAL_POST_LIMIT = 24;
const POST_LIMIT_STEP = 24;
const MAX_POST_LIMIT = 120;

const DAILY_PROMPTS = [
  "帰り道の一枚",
  "今日いちばん心に残った場所",
  "また行きたいお店",
  "空を見上げた瞬間",
  "今日のおいしかったもの",
  "小さな発見をひとつ",
  "誰かに教えたい景色",
] as const;

/** 日本時間の日付だけで決まり、全員に同じテーマを毎日1つ表示する。 */
function getDailyPrompt(): string {
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const hash = [...dayKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return DAILY_PROMPTS[hash % DAILY_PROMPTS.length] ?? DAILY_PROMPTS[0];
}

/** グループに紐付かない、フレンド全員分のテキスト投稿（つぶやき）をまとめて見られるホーム画面 */
export default async function SnsHomePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; limit?: string }>;
}) {
  const [{ supabase, user }, sp] = await Promise.all([requireUser(), searchParams]);

  const requestedLimit = Number.parseInt(sp.limit ?? "", 10);
  const postLimit = Number.isFinite(requestedLimit)
    ? Math.min(MAX_POST_LIMIT, Math.max(INITIAL_POST_LIMIT, requestedLimit))
    : INITIAL_POST_LIMIT;
  const fetchedPosts = await getPersonalTextFeed(supabase, undefined, postLimit + 1);
  const hasMorePosts = fetchedPosts.length > postLimit;
  const posts = fetchedPosts.slice(0, postLimit);
  const filter = parseSnsFeedFilter(sp.filter);
  const dailyPrompt = getDailyPrompt();
  const visiblePosts = posts.filter((post) => matchesSnsFeedFilter(post, filter));
  const feedTitle = filter === "photos" ? "写真つきの投稿" : filter === "notes" ? "ひとこと投稿" : "新しいつぶやき";
  const allPhotoPaths = getSnsTextPostPhotoPaths(visiblePosts);
  const [avatarUrls, photoUrls] = await Promise.all([
    signThumbOrOriginalPaths(supabase, getSnsTextPostAvatarPaths(visiblePosts)),
    signThumbOrOriginalPaths(supabase, allPhotoPaths),
  ]);

  return (
    <>
      <PageHeader
        title="SNS"
        subtitle="フレンドのおでかけが集まる場所"
        showBack={false}
        leftAction={<SnsNotificationEntry />}
        action={(
          <Link
            href="/sns/search"
            prefetch={false}
            aria-label="SNSを検索"
            className="pressable flex h-11 w-11 items-center justify-center rounded-full text-ink-soft active:bg-paper-deep"
          >
            <IconSearch size={20} />
          </Link>
        )}
      />
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody className="sns-page-shell space-y-3">
        <SnsPrimaryNav active="home" userHref={`/sns/users/${user.id}`} groupHref="/sns/groups" />

        <section className="sns-home-welcome is-compact" aria-labelledby="sns-home-title">
          <Image
            src="/illustrations/sns/nav-home-v2.webp"
            alt=""
            width={104}
            height={94}
            priority
            sizes="104px"
            className="sns-home-welcome-art"
          />
          <span className="sns-home-welcome-stamp" aria-hidden="true">TODAY</span>
          <p className="relative text-[10px] font-bold tracking-[0.18em] text-white/75">TODAY&apos;S IDEA</p>
          <span className="relative mt-0.5 flex min-w-0 items-center gap-2 pr-[5.3rem]">
            <h2 id="sns-home-title" className="min-w-0 truncate text-lg font-black text-white">{dailyPrompt}</h2>
            <span className="sns-home-count">{visiblePosts.length}件</span>
          </span>
          <p className="relative mt-0.5 text-[10px] font-semibold text-white/75">みんなの{feedTitle}</p>
        </section>

        <SnsGuideStrip />

        <SnsFeedFilters active={filter} baseHref="/sns/home" />

        <SnsTextFeed
          posts={visiblePosts}
          avatarUrls={avatarUrls}
          photoUrls={photoUrls}
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
        {hasMorePosts && postLimit < MAX_POST_LIMIT ? (
          <Link
            href={`/sns/home?${new URLSearchParams({
              ...(filter === "all" ? {} : { filter }),
              limit: String(Math.min(MAX_POST_LIMIT, postLimit + POST_LIMIT_STEP)),
            }).toString()}`}
            prefetch={false}
            scroll={false}
            className="sns-feed-more pressable"
          >
            以前の投稿をもっと見る
          </Link>
        ) : null}
      </PageBody>
      <Link
        href="/sns/home/new"
        data-haptic="light"
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
