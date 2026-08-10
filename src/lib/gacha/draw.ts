/**
 * 抽選
 * =============================================================
 * まず排出率でレアリティを決め、そのレアリティの景品から等確率で1つ選ぶ。
 * この2段構えにしておくと、景品を1つ足しても他のレアリティの確率は動かない。
 *
 * クライアントから呼ばないこと。結果を書き換えられないよう、
 * サーバー側（API ルート）だけで使う。
 */
import { GACHA_RARITIES, GACHA_RARITY_RATES, type GachaRarity } from "./config";
import { getPrizesByRarity, type GachaPrize } from "./prizes";

/** 排出率にしたがってレアリティを1つ選ぶ */
function pickRarity(): GachaRarity {
  const total = GACHA_RARITIES.reduce((sum, rarity) => sum + Math.max(0, GACHA_RARITY_RATES[rarity]), 0);
  if (total <= 0) return "N";

  let point = Math.random() * total;
  for (const rarity of GACHA_RARITIES) {
    point -= Math.max(0, GACHA_RARITY_RATES[rarity]);
    if (point < 0) return rarity;
  }
  // 端数で最後まで引けなかったときの保険
  return "N";
}

/**
 * 1回ぶんの抽選。
 * 当たったレアリティに景品が無いときは、下のレアリティへ順に落として必ず1つ返す。
 */
function drawOne(): GachaPrize | null {
  const start = GACHA_RARITIES.indexOf(pickRarity());
  for (let index = start; index >= 0; index -= 1) {
    const rarity = GACHA_RARITIES[index];
    if (!rarity) continue;
    const candidates = getPrizesByRarity(rarity);
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
    }
  }
  return null;
}

/** count 回ぶん引く。景品が1つも無ければ空配列 */
export function drawPrizes(count: number): GachaPrize[] {
  const results: GachaPrize[] = [];
  for (let i = 0; i < count; i += 1) {
    const prize = drawOne();
    if (!prize) break;
    results.push(prize);
  }
  return results;
}
