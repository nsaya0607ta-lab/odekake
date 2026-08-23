import { notFound } from "next/navigation";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { markNoticeReadAction } from "@/app/(app)/notices/actions";
import { getNoticeDetail } from "@/lib/data/notices";
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

export default async function NoticeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const notice = await getNoticeDetail(supabase, id);
  if (!notice) notFound();

  if (!notice.is_read) {
    await markNoticeReadAction(notice.id);
  }

  return (
    <>
      <PageHeader title="お知らせ" backHref="/notices" />
      <PageBody>
        <div className="rough-card p-4">
          <div className="flex items-center gap-2 text-xs text-ink-faint">
            <span className="rounded-full bg-paper-deep px-2 py-0.5 font-bold">
              {TYPE_LABEL[notice.type] ?? "お知らせ"}
            </span>
            <span>{formatDateTime(notice.created_at)}</span>
          </div>
          <h1 className="mt-2 text-lg font-bold text-ink">{notice.title}</h1>
          {notice.content ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{notice.content}</p>
          ) : null}
        </div>
      </PageBody>
    </>
  );
}
