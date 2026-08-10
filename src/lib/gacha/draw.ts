/**
 * 抽選
 * =============================================================
 * まずガチャ種別の排出率でレアリティを決め、同じガチャ種別・レアリティの景品から
 * 等確率で1つ選ぶ。サーバー側（API ルート）だけで使う。
 */
import {
  GACHA_RARITIES,
  GACHA_RARITY_RATES_BY_TYPE,
  type GachaRarity,
  type GachaType,
} from "./config";
import { getPrizesByRarity, type GachaPrize } from "./prizes";

/** 排出率にしたがってレアリティを1つ選ぶ */
function pickRarity(gachaType: GachaType): GachaRarity {
  const rates = GACHA_RARITY_RATES_BY_TYPE[gachaType];
  const total = GACHA_RARITIES.reduce((sum, rarity) => sum + Math.max(0, rates[rarity]), 0);
  if (total <= 0) return "N";

  let point = Math.random() * total;
  for (const rarity of GACHA_RARITIES) {
    point -= Math.max(0, rates[rarity]);
    if (point < 0) return rarity;
  }
  return "N";
}

/** 当たったレアリティに景品が無い場合は下位レアリティへ順に落とす */
function drawOne(gachaType: GachaType): GachaPrize | null {
  const start = GACHA_RARITIES.indexOf(pickRarity(gachaType));
  for (let index = start; index >= 0; index -= 1) {
    const rarity = GACHA_RARITIES[index];
    if (!rarity) continue;
    const candidates = getPrizesByRarity(rarity, gachaType);
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
    }
  }
  return null;
}

export function drawPrizes(count: number, gachaType: GachaType): GachaPrize[] {
  const results: GachaPrize[] = [];
  for (let i = 0; i < count; i += 1) {
    const prize = drawOne(gachaType);
    if (!prize) break;
    results.push(prize);
  }
  return results;
}
