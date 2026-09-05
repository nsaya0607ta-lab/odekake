/**
 * 抽選
 * =============================================================
 * 通常ガチャ（src/lib/gacha/draw.ts）と同じ考え方：まず排出率でランクを
 * 決め、同じランクの全ダンボールから等確率で1つ選ぶ。サーバー側（APIルート）
 * だけで使う。
 */
import { DAMBOURLE_RARITIES, DAMBOURLE_RARITY_RATES, type DambourleRarity } from "./config";
import { DAMBOURLE_PRIZES, type DambourleItem } from "./prizes";

function pickRarity(rates: Record<DambourleRarity, number>): DambourleRarity {
  const total = DAMBOURLE_RARITIES.reduce((sum, rarity) => sum + Math.max(0, rates[rarity]), 0);
  if (total <= 0) return "SSR";

  let point = Math.random() * total;
  for (const rarity of DAMBOURLE_RARITIES) {
    point -= Math.max(0, rates[rarity]);
    if (point < 0) return rarity;
  }
  return "SSR";
}

/** 当たったランクにダンボールが無い場合は下位ランクへ順に落とす（現状は全ランクに在籍あり） */
function drawOne(rates: Record<DambourleRarity, number>): DambourleItem | null {
  const start = DAMBOURLE_RARITIES.indexOf(pickRarity(rates));
  for (let index = start; index >= 0; index -= 1) {
    const rarity = DAMBOURLE_RARITIES[index];
    if (!rarity) continue;
    const candidates = DAMBOURLE_PRIZES.filter((prize) => prize.rarity === rarity);
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
    }
  }
  return null;
}

export function drawDambourlePrizes(count: number, rates: Record<DambourleRarity, number> = DAMBOURLE_RARITY_RATES): DambourleItem[] {
  const results: DambourleItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const prize = drawOne(rates);
    if (!prize) break;
    results.push(prize);
  }
  return results;
}
