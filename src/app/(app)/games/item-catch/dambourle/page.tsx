import Link from "next/link";
import { notFound } from "next/navigation";
import { DambourlePicker } from "@/components/dambourle-picker";
import { IconChevronRight, IconCoin } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getEquippedDambourle, getOwnedDambourleCounts } from "@/lib/data/dambourle";
import { isDambourleGachaEnabled } from "@/lib/dambourle/feature-flag";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "ダンボールを選ぶ | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function DambourlePickerPage() {
  const { supabase, user } = await requireUser();
  if (!isDambourleGachaEnabled(user.email)) notFound();

  const [ownedCounts, equipped] = await Promise.all([
    getOwnedDambourleCounts(supabase, user.id),
    getEquippedDambourle(supabase, user.id),
  ]);

  return (
    <>
      <PageHeader title="ダンボールを選ぶ" backHref="/games/item-catch" backReload subtitle="効果とスキンを確認してから装備できます" />
      <PageBody>
        <Link
          href="/games/item-catch/dambourle/gacha"
          className="rough-card flex items-center gap-3 p-4 active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-leaf-soft text-leaf-deep">
            <IconCoin size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">ダンボールガチャを引く</span>
            <span className="mt-0.5 block text-[11px] text-ink-soft">排出率・効果・所持状況を確認できます</span>
          </span>
          <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
        </Link>
        <DambourlePicker
          equippedItemId={equipped?.itemId ?? null}
          equippedSkinIndex={equipped?.skinIndex ?? 0}
          ownedCounts={Object.fromEntries(ownedCounts)}
        />
      </PageBody>
    </>
  );
}
