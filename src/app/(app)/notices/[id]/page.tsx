import { notFound } from "next/navigation";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getNoticeDetail } from "@/lib/data/notices";
import { signPhotoPath } from "@/lib/data/photos";
import { requireUser } from "@/lib/supabase/server";
import { MarkNoticeRead } from "./mark-notice-read";

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
  const imageUrl = await signPhotoPath(supabase, notice.image_path);
  const htmlUrl = await signPhotoPath(supabase, notice.html_path);

  return (
    <>
      {!notice.is_read ? <MarkNoticeRead noticeId={notice.id} /> : null}
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
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="mt-3 w-full rounded-xl" />
          ) : null}
          {notice.content ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{notice.content}</p>
          ) : null}
          {notice.link_url ? (
            <a
              href={notice.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-quiet mt-3 inline-block"
            >
              関連リンクを開く
            </a>
          ) : null}
          {htmlUrl ? (
            // スクリプト・same-originを許可しないsandboxで埋め込み、添付HTML内のコードが
            // アプリと同一オリジンで実行されないようにする（管理者アカウントが侵害された場合の対策）。
            <iframe
              src={htmlUrl}
              sandbox="allow-popups"
              title="添付ページ"
              className="mt-3 h-[70vh] w-full rounded-xl border border-line bg-paper"
            />
          ) : null}
        </div>
      </PageBody>
    </>
  );
}
