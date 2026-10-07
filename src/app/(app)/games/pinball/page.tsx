import type { Metadata } from "next";
import { getImageProps } from "next/image";
import { PinballGame } from "@/components/games/pinball/pinball-game";
import { getOwnedItemCounts } from "@/lib/data/collection";
import { getPinballBests, getRedCoinBalance } from "@/lib/data/red-coins";
import { buildPinballTables } from "@/lib/games/pinball/tables";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "ご当地ピンボール | おでかけ記録",
  description: "都道府県ガチャのご当地アイテムが並ぶピンボール。アイテムを集めてスキルを発動、8個そろえて県制覇。スコアで赤コインがもらえます。",
};
export const dynamic = "force-dynamic";

/** キャンバスに描く大きさ（最大でおよそ60px × 画面の倍率）に合わせて縮めた画像のURL */
function optimize(src: string, width: number): string {
  return getImageProps({ src, alt: "", width, height: width }).props.src;
}

export default async function PinballPage() {
  const { supabase, user } = await requireUser();
  const [owned, bests, redCoins] = await Promise.all([
    getOwnedItemCounts(supabase, user.id),
    getPinballBests(supabase, user.id),
    getRedCoinBalance(supabase, user.id).catch(() => null),
  ]);
  const tables = buildPinballTables(owned, optimize);
  return <PinballGame tables={tables} bests={bests} redCoins={redCoins} />;
}
