import { WankoBowlingGame } from "@/components/wanko-bowling-game";
import { WankoBowlingRanking } from "@/components/wanko-bowling-ranking";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { COLLECTION_ITEMS } from "@/lib/collection/items";
import { getOwnedItemCounts } from "@/lib/data/collection";
import { BOWLING_BALL_ITEM_IDS } from "@/lib/games/wanko-bowling-balls";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "わんこボウリング | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function WankoBowlingPage() {
  const { supabase, user } = await requireUser();
  const ownedItemCounts = await getOwnedItemCounts(supabase, user.id);
  const ballItemIds = new Set<string>(BOWLING_BALL_ITEM_IDS);

  const ownedBalls = COLLECTION_ITEMS.flatMap((item) => {
    if (!ballItemIds.has(item.id)) return [];
    const count = ownedItemCounts.get(item.id) ?? 0;
    if (count <= 0) return [];
    return [{ id: item.id, name: item.name, image: item.image, rarity: item.rarity }];
  });

  return (
    <>
      <TopHeader
        backHref="/games"
        title="わんこボウリング"
        subtitle="お気に入りのボールでストライクを狙おう！"
      />

      <PageBody className="!space-y-3 !py-3">
        <WankoBowlingGame ownedBalls={ownedBalls} />

        <div id="wanko-bowling-ranking">
          <WankoBowlingRanking />
        </div>
      </PageBody>
    </>
  );
}
