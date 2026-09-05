export const DAMBOURLE_RARITIES = ["SSR", "UR", "LR", "MR"] as const;
export type DambourleRarity = (typeof DAMBOURLE_RARITIES)[number];

/** 排出率（%、合計100）。同ランク内は在籍数で均等割り。 */
export const DAMBOURLE_RARITY_RATES: Record<DambourleRarity, number> = {
  SSR: 60,
  UR: 30,
  LR: 9.5,
  MR: 0.5,
};

export const DAMBOURLE_PLANS = {
  single: { draws: 1, cost: 1000, label: "1回まわす" },
  multi: { draws: 10, cost: 9000, label: "10回まわす" },
} as const;

export type DambourlePlanId = keyof typeof DAMBOURLE_PLANS;

export function isDambourlePlanId(value: unknown): value is DambourlePlanId {
  return value === "single" || value === "multi";
}

/** 重複時のコイン還元額（ランク別固定）。supabase/migrations/0088_dambourle_gacha.sql の
 * dambourle_duplicate_coin_for_rank と一致させること。 */
export const DAMBOURLE_DUPLICATE_COIN: Record<DambourleRarity, number> = {
  SSR: 50,
  UR: 150,
  LR: 400,
  MR: 1000,
};

/** ダンボール自身のスキルLv上限。No.11(MR)だけ特殊で、それ以外は70。
 * supabase/migrations/0088_dambourle_gacha.sql の dambourle_level_cap_for_item と一致させること。 */
export const DAMBOURLE_LEVEL_CAP: Record<DambourleRarity, number> = {
  SSR: 70,
  UR: 70,
  LR: 70,
  MR: 5,
};
