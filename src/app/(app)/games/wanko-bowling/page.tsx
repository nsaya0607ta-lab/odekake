import { notFound } from "next/navigation";
import { WankoBowlingGame } from "@/components/wanko-bowling-game";
import { WankoBowlingRanking } from "@/components/wanko-bowling-ranking";
import { BowlingScreenLock } from "@/components/wanko-bowling/screen-lock";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { COLLECTION_ITEMS } from "@/lib/collection/items";
import { getOwnedItemCounts } from "@/lib/data/collection";
import { canAccessWankoBowling } from "@/lib/games/wanko-bowling-access";
import { BOWLING_BALL_ITEM_IDS } from "@/lib/games/wanko-bowling-balls";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "わんこボウリング | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function WankoBowlingPage() {
  const { supabase, user } = await requireUser();
  if (!canAccessWankoBowling(user.email)) notFound();

  const ownedItemCounts = await getOwnedItemCounts(supabase, user.id);
  const ballItemIds = new Set<string>(BOWLING_BALL_ITEM_IDS);

  const ownedBalls = COLLECTION_ITEMS.flatMap((item) => {
    if (!ballItemIds.has(item.id)) return [];
    const count = ownedItemCounts.get(item.id) ?? 0;
    if (count <= 0) return [];
    return [{ id: item.id, name: item.name, image: item.image, rarity: item.rarity }];
  });

  return (
    <div className="fixed inset-0 z-[50] flex h-dvh flex-col overflow-hidden bg-paper">
      <BowlingScreenLock />

      <TopHeader
        backHref="/games"
        title="わんこボウリング"
        action={(
          <span className="rounded-full bg-leaf-soft px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-leaf-deep">
            5 FRAME
          </span>
        )}
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none">
        <PageBody className="!space-y-2 !px-2 !py-2">
          <WankoBowlingGame ownedBalls={ownedBalls} />

          <div id="wanko-bowling-ranking" className="pt-1">
            <WankoBowlingRanking />
          </div>
        </PageBody>
      </div>
    </div>
  );
}
