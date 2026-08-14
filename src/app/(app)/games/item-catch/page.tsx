import Link from "next/link";
import { FrenchieCatchGame } from "@/components/frenchie-catch-game";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { COLLECTION_ITEMS } from "@/lib/collection/items";
import { getOwnedItemIds } from "@/lib/data/collection";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "アイテムキャッチ | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function ItemCatchPage() {
  const { supabase, user } = await requireUser();
  const ownedItemIds = await getOwnedItemIds(supabase, user.id);

  const catchItems = COLLECTION_ITEMS.flatMap((item) => {
    if (!ownedItemIds.has(item.id) || !item.image || item.art) return [];
    return [{ id: item.id, name: item.name, image: item.image, rarity: item.rarity }];
  });

  return (
    <>
      <TopHeader
        title="アイテムキャッチ"
        subtitle="30秒でどこまでキャッチできる？"
        action={
          <Link
            href="/games"
            className="pressable rounded-full border border-line bg-card px-3 py-1.5 text-[10px] font-bold text-ink-soft shadow-sm active:scale-[0.97]"
          >
            ゲーム一覧
          </Link>
        }
      />

      <PageBody className="!space-y-3 !py-3">
        <FrenchieCatchGame ownedItems={catchItems} />
      </PageBody>
    </>
  );
}
