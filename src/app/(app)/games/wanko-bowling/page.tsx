import { WankoBowlingGame } from "@/components/wanko-bowling-game";
import { WankoBowlingRanking } from "@/components/wanko-bowling-ranking";
import { BowlingScreenLock } from "@/components/wanko-bowling/screen-lock";
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
    <div className="fixed inset-0 z-[50] flex h-dvh flex-col overflow-hidden bg-paper">
      <style>{`
        /* 位置決めUIはレーン左上に固定し、投球開始領域から離す。 */
        [data-bowling-gesture-block="true"] > div[data-bowling-position-controls="true"] {
          left: 12px !important;
          top: 12px !important;
          bottom: auto !important;
          transform: scale(0.92);
          transform-origin: left top;
        }

        @media (max-height: 720px) {
          [data-bowling-gesture-block="true"] > div[data-bowling-position-controls="true"] {
            top: 10px !important;
          }
        }
      `}</style>

      <BowlingScreenLock />

      <TopHeader
        backHref="/games"
        title="わんこボウリング"
        subtitle="調整中：プレイはできますが、内容は今後変更されることがあります"
        action={(
          <a
            href="#wanko-bowling-ranking"
            className="pressable shrink-0 rounded-full border border-[#c9b88e] bg-[#fffaf0] px-2.5 py-2 text-[9px] font-black leading-none text-leaf-deep shadow-[0_2px_7px_rgba(85,63,31,0.08)] active:scale-[0.97]"
            aria-label="フレンドのスコアを見る"
          >
            フレンドのスコアを見る
          </a>
        )}
      />

      <main id="wanko-bowling-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-none scroll-smooth">
        <div
          className="h-full min-h-0 px-1.5 pt-1.5"
          style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
        >
          <WankoBowlingGame ownedBalls={ownedBalls} />
        </div>

        <div id="wanko-bowling-ranking" className="scroll-mt-3 px-2 pb-6 pt-3">
          <WankoBowlingRanking />
        </div>
      </main>
    </div>
  );
}
