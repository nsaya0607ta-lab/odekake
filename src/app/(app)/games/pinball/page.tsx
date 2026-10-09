import type { Metadata } from "next";
import { getImageProps } from "next/image";
import { PinballGame } from "@/components/games/pinball/pinball-game";
import { getOwnedItemCounts } from "@/lib/data/collection";
import { getPinballBests, getPinballBoughtParts, getPinballStages } from "@/lib/data/pinball";
import { getRedCoinBalance } from "@/lib/data/red-coins";
import { buildPinballLobby } from "@/lib/games/pinball/tables";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "ご当地ピンボール | おでかけ記録",
  description: "都道府県ガチャのご当地アイテムが並ぶピンボール。形のちがうマップで、アイテムを集めてスキルを発動、どれでも8つ集めて制覇。スコアでもらえる赤コインで部品を買って、自分のステージを作ってフレンドと遊べます。",
};
export const dynamic = "force-dynamic";

/** キャンバスに描く大きさ（最大でおよそ60px × 画面の倍率）に合わせて縮めた画像のURL */
function optimize(src: string, width: number): string {
  return getImageProps({ src, alt: "", width, height: width }).props.src;
}

export default async function PinballPage() {
  const { supabase, user } = await requireUser();
  const [owned, bests, redCoins, stages, boughtParts] = await Promise.all([
    getOwnedItemCounts(supabase, user.id),
    getPinballBests(supabase, user.id),
    getRedCoinBalance(supabase, user.id).catch(() => null),
    // ステージ・部品の仕組み（0138）がまだの環境では null（ステージの欄を出さない）
    getPinballStages(supabase).catch(() => null),
    getPinballBoughtParts(supabase, user.id).catch(() => null),
  ]);
  const lobby = buildPinballLobby(owned, optimize);
  return <PinballGame lobby={lobby} bests={bests} redCoins={redCoins} stages={boughtParts === null ? null : stages} boughtParts={boughtParts} />;
}
