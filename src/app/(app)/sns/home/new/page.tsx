import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsTextComposeForm } from "@/components/sns/sns-text-compose-form";

export const metadata = { title: "投稿する | SNS" };
export const dynamic = "force-dynamic";

export default function NewSnsHomePostPage() {
  return (
    <>
      <PageHeader title="つぶやく" backHref="/sns/home" />
      <PageBody>
        <p className="text-xs leading-relaxed text-ink-faint">フレンド全員に共有されます。</p>
        <SnsTextComposeForm />
      </PageBody>
    </>
  );
}
