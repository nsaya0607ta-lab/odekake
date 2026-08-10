/**
 * ガチャの設定
 * =============================================================
 * 排出率と値段はここだけを書き換えれば変わる。
 * 抽選はサーバー側（src/app/api/gacha/route.ts）でこの値を読んで行う。
 */

export const GACHA_RARITIES = ["N", "R", "SR", "SSR"] as const;
export type GachaRarity = (typeof GACHA_RARITIES)[number];

/**
 * 現在は「夏のフレブル」だけの限定ガチャなので SR 100%。
 * 通常ガチャを追加するときに N / R / SR / SSR の通常配分へ切り替える。
 */
export const GACHA_RARITY_RATES: Record<GachaRarity, number> = {
  N: 0,
  R: 0,
  SR: 100,
  SSR: 0,
};

/** 引き方（1回 / 10連）と消費コイン */
export const GACHA_PLANS = {
  single: { draws: 1, cost: 100, label: "1回まわす" },
  multi: { draws: 10, cost: 900, label: "10回まわす" },
} as const;

export type GachaPlanId = keyof typeof GACHA_PLANS;

export function isGachaPlanId(value: unknown): value is GachaPlanId {
  return typeof value === "string" && value in GACHA_PLANS;
}

/** レアリティの見た目。結果画面のやわらかい配色と揃える */
export const RARITY_STYLES: Record<GachaRarity, { text: string; badge: string }> = {
  N: { text: "text-ink-soft", badge: "bg-line text-ink-soft" },
  R: { text: "text-sky-700", badge: "bg-sky-100 text-sky-700" },
  SR: { text: "text-amber-700", badge: "bg-sun-soft text-amber-700" },
  SSR: { text: "text-rose-700", badge: "bg-rose-100 text-rose-700" },
};
