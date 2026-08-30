import Link from "next/link";
import { FrenchieCatchGame } from "@/components/frenchie-catch-game";
import { IconChevronRight, IconNotebook } from "@/components/icons";
import { ItemCatchRanking } from "@/components/item-catch-ranking";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { COLLECTION_ITEMS } from "@/lib/collection/items";
import { getOwnedItemCounts } from "@/lib/data/collection";
import { getSkillLevel } from "@/lib/gacha/skill-levels";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "アイテムキャッチ | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function ItemCatchPage() {
  const { supabase, user } = await requireUser();
  const ownedItemCounts = await getOwnedItemCounts(supabase, user.id);

  const catchItems = COLLECTION_ITEMS.flatMap((item) => {
    const count = ownedItemCounts.get(item.id) ?? 0;
    if (count <= 0 || !item.image) return [];
    // シリーズの小物アイテムはミニゲーム用スキルが未整備なので、犬スキン(art持ち)以外は出現させない
    if (item.series !== null && item.art === undefined) return [];
    return [{
      id: item.id,
      name: item.name,
      image: item.image,
      rarity: item.rarity,
      level: getSkillLevel(item.rarity, count),
    }];
  });

  return (
    <>
      <TopHeader
        backHref="/games"
        title="アイテムキャッチ"
        subtitle="50秒でどこまでキャッチできる？"
      />

      <PageBody className="!space-y-3 !py-3">
        <FrenchieCatchGame ownedItems={catchItems} />

        <Link
          href="/games/item-catch/guide"
          className="rough-card flex items-center gap-3 p-4 active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-leaf-soft text-leaf-deep">
            <IconNotebook size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">ルールとスキルを見る</span>
            <span className="mt-0.5 block text-[11px] text-ink-soft">得点のしくみと、持っているスキルの効果</span>
          </span>
          <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
        </Link>

        <ItemCatchRanking />
      </PageBody>
    </>
  );
}
