import { FrenchieCatchGame } from "@/components/frenchie-catch-game";
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
    if (count <= 0 || !item.image || item.rarity === "LR") return [];
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
        subtitle="30秒でどこまでキャッチできる？"
      />

      <PageBody className="!space-y-3 !py-3">
        <FrenchieCatchGame ownedItems={catchItems} />
        <ItemCatchRanking />
      </PageBody>
    </>
  );
}
