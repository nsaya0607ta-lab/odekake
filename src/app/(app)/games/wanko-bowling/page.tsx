import Link from "next/link";
import { WankoBowlingGame } from "@/components/wanko-bowling-game";
import { WankoBowlingRanking } from "@/components/wanko-bowling-ranking";
import { BowlingPlayGuide } from "@/components/wanko-bowling/play-guide";
import { BowlingScreenLock } from "@/components/wanko-bowling/screen-lock";
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
    <div className="fixed inset-0 z-[50] flex h-dvh flex-col overflow-hidden bg-[#050a11]">
      <BowlingScreenLock />

      <header className="flex shrink-0 items-center gap-3 border-b border-[#26384b] bg-[linear-gradient(180deg,#121e2d,#08111c)] px-3 py-2 text-white shadow-[0_4px_18px_rgba(0,0,0,0.32)]">
        <Link href="/games" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg font-black active:scale-95" aria-label="ゲーム一覧へ戻る">‹</Link>
        <div className="min-w-0 flex-1">
          <p className="text-[7px] font-black tracking-[0.16em] text-[#71dfff]">おでかけスポーツ</p>
          <h1 className="truncate text-[15px] font-black tracking-[0.04em]">わんこボウリング</h1>
        </div>
          <BowlingPlayGuide />
          <a
            href="#wanko-bowling-ranking"
            className="pressable flex h-8 shrink-0 items-center rounded-full border border-[#4b6a83] bg-[#102538] px-2.5 text-[9px] font-black leading-none text-[#cbeeff] active:scale-[0.97]"
            aria-label="フレンドのスコアを見る"
          >
            フレンド
          </a>
      </header>

      <main id="wanko-bowling-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-none scroll-smooth">
        <div
          className="h-full min-h-0 px-1.5 pt-1.5"
          style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
        >
          <WankoBowlingGame ownedBalls={ownedBalls} />
        </div>

        <div id="wanko-bowling-ranking" className="scroll-mt-3 bg-[#050a11] px-2 pb-6 pt-3">
          <WankoBowlingRanking />
        </div>
      </main>
    </div>
  );
}
