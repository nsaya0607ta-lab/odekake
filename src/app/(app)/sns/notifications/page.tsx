import Link from "next/link";
import { markSnsNotificationsReadAction } from "@/app/actions/sns";
import { IconBell, IconCheck, IconHeart, IconUser, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { formatRelativeTimeJa } from "@/lib/date";
import {
  getSnsNotificationCenter,
  type SnsNotificationItem,
  type SnsNotificationKind,
} from "@/lib/data/sns-notifications";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "通知 | SNS" };
export const dynamic = "force-dynamic";

const KIND_LABELS: Record<SnsNotificationKind, string> = {
  reply: "返信",
  like: "いいね",
  group: "グループ",
};

export default async function SnsNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; read?: string; error?: string }>;
}) {
  const [{ supabase, user }, sp] = await Promise.all([requireUser(), searchParams]);
  const center = await getSnsNotificationCenter(supabase, user.id);
  const view = sp.view === "unread" ? "unread" : "all";
  const visibleItems = view === "unread" ? center.items.filter((item) => item.isUnread) : center.items;

  return (
    <>
      <PageHeader
        title="通知"
        subtitle={center.unreadCount > 0 ? `未読 ${center.unreadCount}件` : "すべて確認済み"}
        backHref="/sns/home"
      />
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody className="space-y-4">
        <section className="sns-notification-hero">
          <span className="sns-notification-hero-icon" aria-hidden="true">
            <IconBell size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-black tracking-[0.16em] text-white/70">TRIP NEWS</span>
            <span className="mt-0.5 block text-lg font-black text-white">旅の便り</span>
            <span className="mt-1 block text-[11px] leading-relaxed text-white/78">
              返信・いいね・グループの新着をまとめて確認できます。
            </span>
          </span>
          {center.unreadCount > 0 ? (
            <form action={markSnsNotificationsReadAction}>
              <button type="submit" className="sns-mark-read pressable">
                <IconCheck size={14} />
                すべて既読
              </button>
            </form>
          ) : null}
        </section>

        {sp.read === "1" ? (
          <p className="rounded-2xl bg-leaf-soft px-3 py-2 text-center text-xs font-bold text-leaf-deep">
            すべて既読にしました
          </p>
        ) : null}
        {sp.error === "read" ? (
          <p className="rounded-2xl bg-blossom-soft px-3 py-2 text-center text-xs font-bold text-blossom">
            既読状態を保存できませんでした
          </p>
        ) : null}

        <nav aria-label="通知の表示切り替え" className="sns-notification-tabs">
          <Link
            href="/sns/notifications"
            aria-current={view === "all" ? "page" : undefined}
            className={`pressable ${view === "all" ? "is-active" : ""}`}
          >
            すべて
          </Link>
          <Link
            href="/sns/notifications?view=unread"
            aria-current={view === "unread" ? "page" : undefined}
            className={`pressable ${view === "unread" ? "is-active" : ""}`}
          >
            未読
            {center.unreadCount > 0 ? <span>{center.unreadCount}</span> : null}
          </Link>
        </nav>

        {visibleItems.length > 0 ? (
          <ul className="space-y-2.5">
            {visibleItems.map((item) => (
              <NotificationRow key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <div className="sns-empty-feed">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-paper-deep text-ink-faint">
              <IconBell size={25} />
            </span>
            <p className="mt-3 text-sm font-bold">{view === "unread" ? "未読の通知はありません" : "通知はまだありません"}</p>
            <p className="mt-1 text-xs text-ink-faint">新しい反応が届くと、ここにまとまります。</p>
          </div>
        )}
      </PageBody>
    </>
  );
}

function NotificationRow({ item }: { item: SnsNotificationItem }) {
  const timeLabel = item.createdAt ? formatRelativeTimeJa(item.createdAt) : item.countLabel;

  return (
    <li>
      <Link
        href={item.href}
        className={`sns-notification-row pressable is-${item.kind} ${item.isUnread ? "is-unread" : ""}`}
      >
        <span className="sns-notification-avatar">
          {item.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : item.kind === "reply" ? (
            <IconUser size={20} />
          ) : item.kind === "like" ? (
            <IconHeart size={20} filled />
          ) : (
            <IconUsers size={20} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold">{item.title}</span>
            {item.isUnread ? (
              <>
                <span className="sns-notification-dot" aria-hidden="true" />
                <span className="sr-only">未読</span>
              </>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-ink-faint">{item.body}</span>
          <span className="mt-1 flex items-center gap-2 text-[10px] font-bold">
            <span className="sns-notification-kind">{KIND_LABELS[item.kind]}</span>
            {timeLabel ? <span className="text-ink-faint">{timeLabel}</span> : null}
          </span>
        </span>
      </Link>
    </li>
  );
}
