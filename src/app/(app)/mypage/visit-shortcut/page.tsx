import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { VisitShortcutSetup } from "@/components/visit-shortcut-setup";
import { getSiteUrl } from "@/lib/supabase/env";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "ショートカット場所登録 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function VisitShortcutSetupPage() {
  await requireUser();
  const endpoint = `${getSiteUrl()}/api/visits/shortcut`;

  return (
    <>
      <PageHeader title="ショートカット場所登録" backHref="/mypage" />
      <PageBody>
        <VisitShortcutSetup endpoint={endpoint} />
      </PageBody>
    </>
  );
}
