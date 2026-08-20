import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsPostForm } from "@/components/sns/sns-post-form";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "投稿する | SNS" };
export const dynamic = "force-dynamic";

export default async function NewSnsHomePhotoPage() {
  const { user } = await requireUser();

  return (
    <>
      <PageHeader title="ホームに投稿" backHref="/sns/home" />
      <PageBody>
        <p className="text-xs leading-relaxed text-ink-faint">
          フレンド全員に共有されます。投稿できるのは今日のうちだけです。
        </p>
        <SnsPostForm userId={user.id} />
      </PageBody>
    </>
  );
}
