import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { StepSyncSetup } from "@/components/step-sync-setup";
import { getSiteUrl } from "@/lib/supabase/env";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "iPhone歩数連携 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function StepSyncPage() {
  await requireUser();
  const endpoint = `${getSiteUrl()}/api/steps/sync`;

  return (
    <>
      <TopHeader title="iPhone歩数連携" backHref="/mypage" />
      <PageBody>
        <StepSyncSetup endpoint={endpoint} />
      </PageBody>
    </>
  );
}
