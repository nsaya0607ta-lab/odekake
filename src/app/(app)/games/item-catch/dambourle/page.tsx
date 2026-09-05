import { notFound } from "next/navigation";
import { DambourleGachaSection } from "@/components/dambourle-gacha-section";
import { DambourlePicker } from "@/components/dambourle-picker";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getCoinSummary } from "@/lib/data/coins";
import { getEquippedDambourle, getOwnedDambourleCounts } from "@/lib/data/dambourle";
import { isDambourleGachaEnabled } from "@/lib/dambourle/feature-flag";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "ダンボールを選ぶ | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function DambourlePickerPage() {
  const { supabase, user } = await requireUser();
  if (!isDambourleGachaEnabled(user.email)) notFound();

  const [ownedCounts, equipped, coinSummary] = await Promise.all([
    getOwnedDambourleCounts(supabase, user.id),
    getEquippedDambourle(supabase, user.id),
    getCoinSummary(supabase, user.id),
  ]);

  return (
    <>
      <PageHeader title="ダンボールを選ぶ" backHref="/games/item-catch" subtitle="ガチャで手に入れたダンボール・スキンに変えられます" />
      <PageBody>
        <DambourleGachaSection balance={coinSummary.balance} />
        <DambourlePicker
          equippedItemId={equipped?.itemId ?? null}
          equippedSkinIndex={equipped?.skinIndex ?? 0}
          ownedCounts={Object.fromEntries(ownedCounts)}
        />
      </PageBody>
    </>
  );
}
