import { notFound } from "next/navigation";
import { DambourleGachaSection } from "@/components/dambourle-gacha-section";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getCoinSummary } from "@/lib/data/coins";
import { getOwnedDambourleCounts } from "@/lib/data/dambourle";
import { isDambourleGachaEnabled } from "@/lib/dambourle/feature-flag";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "ダンボールガチャ | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function DambourleGachaPage() {
  const { supabase, user } = await requireUser();
  if (!isDambourleGachaEnabled(user.email)) notFound();

  const [summary, ownedCounts] = await Promise.all([
    getCoinSummary(supabase, user.id),
    getOwnedDambourleCounts(supabase, user.id),
  ]);

  return (
    <>
      <PageHeader title="ダンボールガチャ" backHref="/games/item-catch/dambourle" backReload subtitle="アイテムキャッチ専用" />
      <PageBody>
        <DambourleGachaSection balance={summary.balance} ownedCounts={Object.fromEntries(ownedCounts)} />
      </PageBody>
    </>
  );
}
