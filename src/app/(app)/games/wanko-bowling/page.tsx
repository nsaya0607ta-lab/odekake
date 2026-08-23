import { notFound } from "next/navigation";
import { WankoBowlingGame } from "@/components/wanko-bowling-game";
import { WankoBowlingRanking } from "@/components/wanko-bowling-ranking";
import { BowlingScreenLock } from "@/components/wanko-bowling/screen-lock";
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
      <style>{`
        /* 位置決めUIをボールの投球開始領域から離す。 */
        [data-bowling-gesture-block="true"] > div:has(> button[aria-pressed]) {
          left: 12px !important;
          bottom: 12% !important;
          transform: scale(0.92);
          transform-origin: left bottom;
        }

        @media (max-height: 720px) {
          [data-bowling-gesture-block="true"] > div:has(> button[aria-pressed]) {
            bottom: 14% !important;
          }
        }
      `}</style>

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

      <main id="wanko-bowling-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-none">
        <div
          className="h-full min-h-0 px-1.5 pt-1.5"
          style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
        >
          <WankoBowlingGame ownedBalls={ownedBalls} />
        </div>

        <div id="wanko-bowling-ranking" className="px-2 pb-6 pt-3">
          <WankoBowlingRanking />
        </div>
      </main>
    </div>
  );
}
