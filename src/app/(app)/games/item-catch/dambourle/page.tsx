import { DambourlePicker } from "@/components/dambourle-picker";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getEquippedDambourle, getOwnedDambourleCounts } from "@/lib/data/dambourle";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "ダンボールを選ぶ | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function DambourlePickerPage() {
  const { supabase, user } = await requireUser();
  const [ownedCounts, equipped] = await Promise.all([
    getOwnedDambourleCounts(supabase, user.id),
    getEquippedDambourle(supabase, user.id),
  ]);

  return (
    <>
      <PageHeader title="ダンボールを選ぶ" backHref="/games/item-catch" subtitle="ガチャで手に入れたダンボール・スキンに変えられます" />
      <PageBody>
        <DambourlePicker
          equippedItemId={equipped?.itemId ?? null}
          equippedSkinIndex={equipped?.skinIndex ?? 0}
          ownedCounts={Object.fromEntries(ownedCounts)}
        />
      </PageBody>
    </>
  );
}
