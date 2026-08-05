import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { JoinTripForm } from "@/components/join-trip-form";

export const metadata = { title: "共有旅に参加 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  return (
    <>
      <PageHeader title="共有旅に参加" backHref="/home" />
      <PageBody>
        <p className="rough-card px-4 py-4 text-sm leading-relaxed text-ink-soft">
          招待コードを確認して「参加する」を押すと、共有旅のメンバーになります。
        </p>
        <JoinTripForm defaultCode={decodeURIComponent(code).toUpperCase()} />
      </PageBody>
    </>
  );
}
