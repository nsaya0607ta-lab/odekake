/**
 * ガチャの設定
 * =============================================================
 * ガチャ種別ごとの排出率と値段をまとめて管理する。
 */

export const GACHA_RARITIES = ["N", "R", "SR", "SSR", "UR", "LR"] as const;
export type GachaRarity = (typeof GACHA_RARITIES)[number];

export const GACHA_TYPES = ["regular", "summer"] as const;
export type GachaType = (typeof GACHA_TYPES)[number];

export const GACHA_TYPE_LABELS: Record<GachaType, string> = {
  regular: "通常ガチャ",
  summer: "夏限定",
};

/**
 * ガチャ種別ごとのレアリティ排出率（合計100%）。実際の抽選に使う内部値。
 * LR は0.5%のぶんNから差し引いてあるが、画面の排出率表示ではNをまとめて50%と見せ、
 * LRの存在自体を出さない（GACHA_DISPLAY_RARITY_RATES_BY_TYPE を参照）。
 */
export const GACHA_RARITY_RATES_BY_TYPE: Record<GachaType, Record<GachaRarity, number>> = {
  regular: {
    N: 49.5,
    R: 25,
    SR: 16,
    SSR: 6,
    UR: 3,
    LR: 0.5,
  },
  summer: {
    N: 0,
    R: 0,
    SR: 100,
    SSR: 0,
    UR: 0,
    LR: 0,
  },
};

/** 旧参照向け。通常ガチャを標準とする */
export const GACHA_RARITY_RATES = GACHA_RARITY_RATES_BY_TYPE.regular;

/** 画面の排出率表示専用。LRは伏せて、そのぶんをNに合算して見せる。 */
export const GACHA_DISPLAY_RARITY_RATES_BY_TYPE: Record<GachaType, Record<GachaRarity, number>> = {
  regular: {
    N: 50,
    R: 25,
    SR: 16,
    SSR: 6,
    UR: 3,
    LR: 0,
  },
  summer: GACHA_RARITY_RATES_BY_TYPE.summer,
};

/** 旧参照向け。通常ガチャを標準とする */
export const GACHA_DISPLAY_RARITY_RATES = GACHA_DISPLAY_RARITY_RATES_BY_TYPE.regular;

/** 引き方（1回 / 10連）と消費コイン */
export const GACHA_PLANS = {
  single: { draws: 1, cost: 100, label: "1回まわす" },
  multi: { draws: 10, cost: 900, label: "10回まわす" },
} as const;

export type GachaPlanId = keyof typeof GACHA_PLANS;

export function isGachaPlanId(value: unknown): value is GachaPlanId {
  return typeof value === "string" && value in GACHA_PLANS;
}

export function isGachaType(value: unknown): value is GachaType {
  return typeof value === "string" && (GACHA_TYPES as readonly string[]).includes(value);
}

/** レアリティの見た目。結果画面のやわらかい配色と揃える */
export const RARITY_STYLES: Record<GachaRarity, { text: string; badge: string }> = {
  N: { text: "text-ink-soft", badge: "bg-line text-ink-soft" },
  R: { text: "text-sky-700", badge: "bg-sky-100 text-sky-700" },
  SR: { text: "text-amber-700", badge: "bg-sun-soft text-amber-700" },
  SSR: { text: "text-rose-700", badge: "bg-rose-100 text-rose-700" },
  UR: { text: "text-red-800", badge: "bg-red-100 text-red-800" },
  LR: { text: "text-amber-900", badge: "bg-ink text-amber-300" },
};
