import { notFound } from "next/navigation";
import { AdminNoticeEditForm } from "./admin-notice-edit-form";
import { AdminNoticeForm } from "./admin-notice-form";
import { getNoticesFeed, isNoticeAdmin } from "@/lib/data/notices";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "お知らせ配信 | おでかけ記録" };
export const dynamic = "force-dynamic";

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

export default async function AdminNoticePage() {
  const { supabase } = await requireUser();
  const isAdmin = await isNoticeAdmin(supabase);
  if (!isAdmin) notFound();

  const notices = await getNoticesFeed(supabase, 50);
  const adminNotices = notices.filter((notice) => notice.type === "admin");

  return (
    <>
      <PageHeader title="お知らせ配信" backHref="/notices" />
      <PageBody>
        <p className="px-1 text-sm text-ink-soft">
          ここで送信した内容は、全ユーザーの「お知らせ」に配信されます。
        </p>
        <AdminNoticeForm />

        {adminNotices.length > 0 ? (
          <section className="space-y-2">
            <h2 className="px-1 text-base font-bold">配信済みのお知らせ</h2>
            <ul className="space-y-2">
              {adminNotices.map((notice) => (
                <li key={notice.id} className="rough-card p-4">
                  <p className="text-xs text-ink-faint">{formatDateTime(notice.created_at)}</p>
                  <details className="mt-1">
                    <summary className="cursor-pointer font-semibold">{notice.title}</summary>
                    <AdminNoticeEditForm noticeId={notice.id} initialMessage={notice.title} />
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </PageBody>
    </>
  );
}
