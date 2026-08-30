import { notFound } from "next/navigation";
import { deleteAdminNoticeAction } from "./actions";
import { AdminNoticeEditForm } from "./admin-notice-edit-form";
import { AdminNoticeForm } from "./admin-notice-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { getNoticesFeed, isNoticeAdmin } from "@/lib/data/notices";
import { signPhotoPath } from "@/lib/data/photos";
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
  const { supabase, user } = await requireUser();
  const isAdmin = await isNoticeAdmin(supabase);
  if (!isAdmin) notFound();

  const notices = await getNoticesFeed(supabase, 50);
  const adminNotices = notices.filter((notice) => notice.type === "admin");
  const adminNoticeImageUrls = new Map(
    await Promise.all(
      adminNotices.map(async (notice) => [notice.id, await signPhotoPath(supabase, notice.image_path)] as const),
    ),
  );

  return (
    <>
      <PageHeader title="お知らせ配信" backHref="/notices" />
      <PageBody>
        <p className="px-1 text-sm text-ink-soft">
          ここで送信した内容は、全ユーザーの「お知らせ」に配信されます。
        </p>
        <AdminNoticeForm userId={user.id} />

        {adminNotices.length > 0 ? (
          <section className="space-y-2">
            <h2 className="px-1 text-base font-bold">配信済みのお知らせ</h2>
            <ul className="space-y-2">
              {adminNotices.map((notice) => (
                <li key={notice.id} className="rough-card p-4">
                  <p className="text-xs text-ink-faint">{formatDateTime(notice.created_at)}</p>
                  <details className="mt-1">
                    <summary className="cursor-pointer font-semibold">{notice.title}</summary>
                    <AdminNoticeEditForm
                      noticeId={notice.id}
                      userId={user.id}
                      initialTitle={notice.title}
                      initialMessage={notice.content ?? notice.title}
                      initialImagePath={notice.image_path}
                      initialImageUrl={adminNoticeImageUrls.get(notice.id) ?? null}
                    />
                    <form action={deleteAdminNoticeAction} className="mt-2">
                      <input type="hidden" name="noticeId" value={notice.id} />
                      <ConfirmSubmitButton message="このお知らせを削除しますか？" pendingLabel="削除中…">
                        削除する
                      </ConfirmSubmitButton>
                    </form>
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
