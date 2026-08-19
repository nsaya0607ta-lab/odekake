import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/supabase/server";
import { SnsPostForm } from "./sns-post-form";

export const metadata = { title: "写真を投稿 | SNS" };
export const dynamic = "force-dynamic";

export default async function SnsNewPage() {
  const { user } = await requireUser();

  return (
    <>
      <PageHeader title="写真を投稿" backHref="/sns" />
      <PageBody>
        <p className="text-xs leading-relaxed text-ink-faint">
          カメラで撮った写真、アルバムの写真、どちらも選べます。投稿できるのは今日のうちだけです。
        </p>
        <SnsPostForm userId={user.id} />
      </PageBody>
    </>
  );
}
