/**
 * 抽選
 * =============================================================
 * pool（通常ガチャ / シリーズ限定ガチャ）ごとに独立した排出率・排出プールで抽選する。
 * まずその pool の排出率でレアリティを決め、同じレアリティ・同じ pool の
 * 景品から等確率で1つ選ぶ。サーバー側（API ルート）だけで使う。
 */
import { GACHA_RARITIES, GACHA_RARITY_RATES_BY_TYPE, type GachaRarity, type GachaType } from "./config";
import { GACHA_PRIZES, type GachaPrize } from "./prizes";

/** その pool の排出率にしたがってレアリティを1つ選ぶ */
function pickRarity(pool: GachaType): GachaRarity {
  const rates = GACHA_RARITY_RATES_BY_TYPE[pool];
  const total = GACHA_RARITIES.reduce((sum, rarity) => sum + Math.max(0, rates[rarity]), 0);
  if (total <= 0) return "N";

  let point = Math.random() * total;
  for (const rarity of GACHA_RARITIES) {
    point -= Math.max(0, rates[rarity]);
    if (point < 0) return rarity;
  }
  return "N";
}

/** 当たったレアリティに同じ pool の景品が無い場合は下位レアリティへ順に落とす */
function drawOne(pool: GachaType): GachaPrize | null {
  const start = GACHA_RARITIES.indexOf(pickRarity(pool));
  for (let index = start; index >= 0; index -= 1) {
    const rarity = GACHA_RARITIES[index];
    if (!rarity) continue;
    const candidates = GACHA_PRIZES.filter((prize) => prize.rarity === rarity && prize.pool === pool);
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
    }
  }
  return null;
}

export function drawPrizes(count: number, pool: GachaType): GachaPrize[] {
  const results: GachaPrize[] = [];
  for (let i = 0; i < count; i += 1) {
    const prize = drawOne(pool);
    if (!prize) break;
    results.push(prize);
  }
  return results;
}
