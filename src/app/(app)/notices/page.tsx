import Link from "next/link";
import { markNoticeReadAction } from "./actions";
import { IconSettings } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getNoticesFeed, isNoticeAdmin } from "@/lib/data/notices";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "お知らせ | おでかけ記録" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  friend_spot: "フレンド",
  minigame_best: "ミニゲーム",
  steps_10000: "歩数",
  collection_rare: "図鑑",
  admin: "運営",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function NoticesPage() {
  const { supabase } = await requireUser();
  const [notices, isAdmin] = await Promise.all([getNoticesFeed(supabase, 30), isNoticeAdmin(supabase)]);

  return (
    <>
      <PageHeader
        title="お知らせ"
        backHref="/home"
        action={
          isAdmin ? (
            <Link
              href="/notices/admin"
              aria-label="お知らせを配信する"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft active:bg-paper-deep"
            >
              <IconSettings size={20} />
            </Link>
          ) : undefined
        }
      />
      <PageBody>
        {notices.length === 0 ? (
          <p className="px-1 text-sm text-ink-soft">まだお知らせはありません。</p>
        ) : (
          <ul className="space-y-2">
            {notices.map((notice) => (
              <li
                key={notice.id}
                className={`rough-card transition-opacity ${notice.is_read ? "opacity-55" : "border-leaf shadow-sm"}`}
              >
                <form action={markNoticeReadAction}>
                  <input type="hidden" name="noticeId" value={notice.id} />
                  <button type="submit" className="block w-full p-4 text-left" disabled={notice.is_read}>
                    <div className="flex items-center gap-2 text-xs text-ink-faint">
                      <span className="rounded-full bg-paper-deep px-2 py-0.5 font-bold">
                        {TYPE_LABEL[notice.type] ?? "お知らせ"}
                      </span>
                      <span>{formatDateTime(notice.created_at)}</span>
                      {notice.is_read ? (
                        <span className="ml-auto text-[10px] font-bold">既読</span>
                      ) : (
                        <span className="ml-auto rounded-full bg-blossom px-2 py-0.5 text-[10px] font-bold text-card">
                          未読・タップで既読
                        </span>
                      )}
                    </div>
                    <p className={`mt-1.5 ${notice.is_read ? "font-semibold text-ink-soft" : "font-bold text-ink"}`}>
                      {notice.title}
                    </p>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}
