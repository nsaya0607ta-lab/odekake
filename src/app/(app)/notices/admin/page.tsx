import { notFound } from "next/navigation";
import { AdminNoticeForm } from "./admin-notice-form";
import { isNoticeAdmin } from "@/lib/data/notices";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "お知らせ配信 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function AdminNoticePage() {
  const { supabase } = await requireUser();
  const isAdmin = await isNoticeAdmin(supabase);
  if (!isAdmin) notFound();

  return (
    <>
      <PageHeader title="お知らせ配信" backHref="/notices" />
      <PageBody>
        <p className="px-1 text-sm text-ink-soft">
          ここで送信した内容は、全ユーザーの「お知らせ」に配信されます。
        </p>
        <AdminNoticeForm />
      </PageBody>
    </>
  );
}
