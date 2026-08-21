import Link from "next/link";
import { IconPlus, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsGroupList } from "@/components/sns/sns-group-list";
import { SnsPrimaryNav } from "@/components/sns/sns-primary-nav";
import { SnsNotificationEntry } from "@/components/sns/sns-notification-button";
import { getMyFriendGroupSummaries, signGroupIconUrls } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "グループ | SNS" };
export const dynamic = "force-dynamic";

/** 参加中のグループを、未読と最新の動きが分かる一覧として表示する。 */
export default async function SnsGroupsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ supabase, user }, sp] = await Promise.all([requireUser(), searchParams]);
  const groups = await getMyFriendGroupSummaries(supabase);
  const iconUrls = await signGroupIconUrls(supabase, groups);
  const view = sp.view === "unread" ? "unread" : "all";
  const unreadGroups = groups.filter((group) => group.has_unread);
  const visibleGroups = view === "unread" ? unreadGroups : groups;
  const totalUnread = groups.reduce((sum, group) => sum + group.unread_count, 0);

  return (
    <>
      <PageHeader
        title="SNS"
        subtitle="写真とチャットをグループで共有"
        showBack={false}
        leftAction={<SnsNotificationEntry />}
      />
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody className="space-y-3">
        <SnsPrimaryNav active="group" userHref={`/sns/users/${user.id}`} groupHref="/sns/groups" />

        <section className="sns-groups-hero is-compact" aria-labelledby="sns-groups-title">
          <span className="sns-groups-hero-orbit" aria-hidden="true" />
          <span className="sns-groups-hero-icon" aria-hidden="true">
            <IconUsers size={28} />
          </span>
          <div className="relative min-w-0 flex-1">
            <p className="text-[10px] font-black tracking-[0.18em] text-white/70">TRIP ROOMS</p>
            <h1 id="sns-groups-title" className="mt-0.5 truncate text-lg font-black text-white">みんなの旅部屋</h1>
            <p className="mt-0.5 text-[10px] font-bold text-white/75">{groups.length}グループ・未読 {totalUnread}件</p>
          </div>
          <Link href="/sns/groups/new" className="sns-groups-create pressable" aria-label="新しいグループを作る">
            <IconPlus size={18} />
            <span>作る</span>
          </Link>
        </section>

        {groups.length > 0 ? (
          <>
            <nav className="sns-group-list-tabs" aria-label="グループの絞り込み">
              <Link href="/sns/groups" scroll={false} className={view === "all" ? "is-active" : undefined}>
                すべて
                <span>{groups.length}</span>
              </Link>
              <Link href="/sns/groups?view=unread" scroll={false} className={view === "unread" ? "is-active" : undefined}>
                未読
                <span>{totalUnread > 99 ? "99+" : totalUnread}</span>
              </Link>
            </nav>

            {visibleGroups.length > 0 ? (
              <SnsGroupList groups={visibleGroups} iconUrls={iconUrls} currentUserId={user.id} />
            ) : (
              <div className="sns-empty-feed px-6 py-8">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                  <IconUsers size={24} />
                </span>
                <p className="mt-3 text-sm font-black">未読はありません</p>
                <p className="mt-1.5 text-xs text-ink-faint">すべてのグループをチェックできています。</p>
              </div>
            )}
          </>
        ) : (
          <div className="sns-empty-feed px-6 py-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
              <IconUsers size={28} />
            </span>
            <p className="mt-3 font-black">まだグループがありません</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
              フレンドの中からグループを作って、写真とチャットを共有しましょう。
            </p>
            <Link href="/sns/groups/new" className="btn btn-primary mt-4 inline-flex">
              <IconPlus size={18} />
              グループを作る
            </Link>
          </div>
        )}
      </PageBody>
    </>
  );
}
