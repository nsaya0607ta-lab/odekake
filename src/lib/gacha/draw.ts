/**
 * 抽選
 * =============================================================
 * 通常・シリーズを分けず、全景品を1つのガチャから抽選する。
 * まず共通の排出率でレアリティを決め、同じレアリティの全景品から
 * 等確率で1つ選ぶ。サーバー側（API ルート）だけで使う。
 */
import { GACHA_RARITIES, GACHA_RARITY_RATES, type GachaRarity } from "./config";
import { GACHA_PRIZES, type GachaPrize } from "./prizes";

/** 共通排出率にしたがってレアリティを1つ選ぶ */
function pickRarity(): GachaRarity {
  const total = GACHA_RARITIES.reduce(
    (sum, rarity) => sum + Math.max(0, GACHA_RARITY_RATES[rarity]),
    0,
  );
  if (total <= 0) return "N";

  let point = Math.random() * total;
  for (const rarity of GACHA_RARITIES) {
    point -= Math.max(0, GACHA_RARITY_RATES[rarity]);
    if (point < 0) return rarity;
  }
  return "N";
}

/** 当たったレアリティに景品が無い場合は下位レアリティへ順に落とす */
function drawOne(): GachaPrize | null {
  const start = GACHA_RARITIES.indexOf(pickRarity());
  for (let index = start; index >= 0; index -= 1) {
    const rarity = GACHA_RARITIES[index];
    if (!rarity) continue;
    const candidates = GACHA_PRIZES.filter((prize) => prize.rarity === rarity);
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
    }
  }
  return null;
}

export function drawPrizes(count: number): GachaPrize[] {
  const results: GachaPrize[] = [];
  for (let i = 0; i < count; i += 1) {
    const prize = drawOne();
    if (!prize) break;
    results.push(prize);
  }
  return results;
}
