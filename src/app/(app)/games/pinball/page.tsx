import type { Metadata } from "next";
import { getImageProps } from "next/image";
import { PinballGame } from "@/components/games/pinball/pinball-game";
import { getOwnedItemCounts } from "@/lib/data/collection";
import { getBlueCoinBalance } from "@/lib/data/blue-coins";
import { getPinballBests } from "@/lib/data/pinball";
import { buildPinballLobby } from "@/lib/games/pinball/tables";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "ご当地ピンボール | おでかけ記録",
  description: "都道府県ガチャのご当地アイテムが並ぶピンボール。形のちがうマップで、アイテムを集めてスキルを発動、どれでも8つ集めて制覇。集めるほど図鑑ボーナスで得点アップ。スコアで青コインがもらえます。",
};
export const dynamic = "force-dynamic";

/** キャンバスに描く大きさ（最大でおよそ60px × 画面の倍率）に合わせて縮めた画像のURL */
function optimize(src: string, width: number): string {
  return getImageProps({ src, alt: "", width, height: width }).props.src;
}

export default async function PinballPage() {
  const { supabase, user } = await requireUser();
  const [owned, bests, blueCoins] = await Promise.all([
    getOwnedItemCounts(supabase, user.id),
    getPinballBests(supabase, user.id),
    getBlueCoinBalance(supabase, user.id).catch(() => null),
  ]);
  const lobby = buildPinballLobby(owned, optimize);
  return <PinballGame lobby={lobby} bests={bests} blueCoins={blueCoins} />;
}
