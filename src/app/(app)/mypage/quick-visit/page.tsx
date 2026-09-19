import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { QuickVisitSetup } from "@/components/quick-visit-setup";
import { getSiteUrl } from "@/lib/supabase/env";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "かんたん場所登録の設定 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function QuickVisitSetupPage() {
  await requireUser();
  const shortcutUrl = `${getSiteUrl()}/quick-visit`;

  return (
    <>
      <PageHeader title="かんたん場所登録の設定" backHref="/mypage" />
      <PageBody>
        <QuickVisitSetup shortcutUrl={shortcutUrl} />
      </PageBody>
    </>
  );
}
