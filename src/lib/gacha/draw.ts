/**
 * 抽選
 * =============================================================
 * 通常ガチャ（黄色コイン）は、都道府県の景品をのぞいた全景品から抽選する。
 * まず共通の排出率でレアリティを決め、同じレアリティの景品から等確率で1つ選ぶ。
 *
 * 都道府県ガチャ（青コイン）も同じ排出率でレアリティを決め、そのレアリティの
 * 都道府県の景品から選ぶ。都道府県の景品がまだ無いレアリティは、通常ガチャの
 * 同じレアリティの景品から選ぶ（都道府県の景品がそろうまでの つなぎ）。
 * サーバー側（API ルート）だけで使う。
 */
import { GACHA_RARITIES, GACHA_RARITY_RATES, type GachaRarity } from "./config";
import { COIN_GACHA_PRIZES, PREF_GACHA_PRIZES, type GachaPrize } from "./prizes";

export type GachaPool = "coin" | "pref";

/** 指定した排出率にしたがってレアリティを1つ選ぶ */
function pickRarity(rates: Record<GachaRarity, number>): GachaRarity {
  const total = GACHA_RARITIES.reduce(
    (sum, rarity) => sum + Math.max(0, rates[rarity]),
    0,
  );
  if (total <= 0) return "N";

  let point = Math.random() * total;
  for (const rarity of GACHA_RARITIES) {
    point -= Math.max(0, rates[rarity]);
    if (point < 0) return rarity;
  }
  return "N";
}

/** 当たったレアリティに景品が無い場合は下位レアリティへ順に落とす */
function drawOne(rates: Record<GachaRarity, number>, pool: GachaPool): GachaPrize | null {
  const start = GACHA_RARITIES.indexOf(pickRarity(rates));
  for (let index = start; index >= 0; index -= 1) {
    const rarity = GACHA_RARITIES[index];
    if (!rarity) continue;
    const pref = pool === "pref" ? PREF_GACHA_PRIZES.filter((prize) => prize.rarity === rarity) : [];
    const candidates = pref.length > 0 ? pref : COIN_GACHA_PRIZES.filter((prize) => prize.rarity === rarity);
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
    }
  }
  return null;
}

/** rates を省略すると通常の排出率（GACHA_RARITY_RATES）を使う。100連だけは専用の排出率を渡す。 */
export function drawPrizes(count: number, rates: Record<GachaRarity, number> = GACHA_RARITY_RATES, pool: GachaPool = "coin"): GachaPrize[] {
  const results: GachaPrize[] = [];
  for (let i = 0; i < count; i += 1) {
    const prize = drawOne(rates, pool);
    if (!prize) break;
    results.push(prize);
  }
  return results;
}
