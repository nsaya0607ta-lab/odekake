import type { DambourleRarity } from "./config";

/**
 * ダンボールガチャの景品一覧。
 * id は supabase/migrations/0088_dambourle_gacha.sql の
 * dambourle_rank_for_item / dambourle_skin_tier_for_item にハードコードされた
 * id と一致させること（永続保存されるため一度決めたら変更しない）。
 *
 * name は仮称（"No.1"形式）。正式名称が決まったらここだけ差し替える。
 */
export type DambourleEffectKey =
  | "item_spawn_up" // No.1 アイテム出現量アップ
  | "score_mult_up" // No.2 スコア倍率アップ
  | "time_bonus_cutoff_up" // No.3 時間増加アップ（カットオフ延長）
  | "box_size_up" // No.4 ダンボール自体の大きさアップ
  | "end_coin_bonus" // No.5 ゲーム終了時コイン増加
  | "dog_bonus_mult_up" // No.6 フレブルボーナスの倍率アップ
  | "negative_spawn_down" // No.7 マイナスアイテムの出現率ダウン
  | "time_pool_rate_up" // No.8 時間系プールの出現率アップ
  | "spawn_dynamics_effect_up" // No.9 出現量倍増プールの効果アップ
  | "score_mult_pool_effect_up" // No.10 得点倍率系プールの効果アップ
  | "effect_roulette" // No.12 効果ルーレット
  | "item_base_score_up" // No.13 全アイテムの基礎スコアプラス
  | "item_skill_level_up"; // No.11 全アイテムのスキルLv上昇

export type DambourleItem = {
  /** DB(user_dambourle_items.item_id)に永続保存されるため不変 */
  id: string;
  /** 仮称。正式名称決定後に差し替える */
  name: string;
  rarity: DambourleRarity;
  effectKey: DambourleEffectKey;
  /** 基礎値（%）。倍率式 1 + 0.02×(Lv-1) を掛けた値が実際の効果値になる。No.11は対象外(null)。 */
  baseValuePercent: number | null;
};

export const DAMBOURLE_PRIZES: readonly DambourleItem[] = [
  // --- SSR（排出率60%、6種・各10%） ---
  { id: "dambourle_no6", name: "No.6", rarity: "SSR", effectKey: "dog_bonus_mult_up", baseValuePercent: 10 },
  { id: "dambourle_no7", name: "No.7", rarity: "SSR", effectKey: "negative_spawn_down", baseValuePercent: 10 },
  { id: "dambourle_no8", name: "No.8", rarity: "SSR", effectKey: "time_pool_rate_up", baseValuePercent: 10 },
  { id: "dambourle_no9", name: "No.9", rarity: "SSR", effectKey: "spawn_dynamics_effect_up", baseValuePercent: 10 },
  { id: "dambourle_no13", name: "No.13", rarity: "SSR", effectKey: "item_base_score_up", baseValuePercent: 10 },
  { id: "dambourle_no5", name: "No.5", rarity: "SSR", effectKey: "end_coin_bonus", baseValuePercent: 50 },

  // --- UR（排出率30%、4種・各7.5%） ---
  { id: "dambourle_no2", name: "No.2", rarity: "UR", effectKey: "score_mult_up", baseValuePercent: 20 },
  { id: "dambourle_no3", name: "No.3", rarity: "UR", effectKey: "time_bonus_cutoff_up", baseValuePercent: 20 },
  { id: "dambourle_no10", name: "No.10", rarity: "UR", effectKey: "score_mult_pool_effect_up", baseValuePercent: 10 },
  { id: "dambourle_no12", name: "No.12", rarity: "UR", effectKey: "effect_roulette", baseValuePercent: null },

  // --- LR（排出率9.5%、2種・各4.75%） ---
  { id: "dambourle_no1", name: "No.1", rarity: "LR", effectKey: "item_spawn_up", baseValuePercent: 10 },
  { id: "dambourle_no4", name: "No.4", rarity: "LR", effectKey: "box_size_up", baseValuePercent: 10 },

  // --- MR（排出率0.5%、1種） ---
  { id: "dambourle_no11", name: "No.11", rarity: "MR", effectKey: "item_skill_level_up", baseValuePercent: null },
];

const DAMBOURLE_PRIZE_BY_ID = new Map(DAMBOURLE_PRIZES.map((prize) => [prize.id, prize]));
const DAMBOURLE_EFFECT_BASE_VALUE_PERCENT = new Map(
  DAMBOURLE_PRIZES.filter((prize) => prize.baseValuePercent !== null).map((prize) => [prize.effectKey, prize.baseValuePercent!]),
);

export const DAMBOURLE_EFFECT_LABELS: Readonly<Partial<Record<DambourleEffectKey, string>>> = {
  item_spawn_up: "アイテム出現量",
  score_mult_up: "スコア倍率",
  time_bonus_cutoff_up: "時間増加アイテムの出現期限",
  box_size_up: "ダンボールサイズ",
  end_coin_bonus: "ゲーム終了時の獲得コイン",
  dog_bonus_mult_up: "フレブルボーナス倍率",
  negative_spawn_down: "マイナスアイテム出現率",
  time_pool_rate_up: "時間増加系の出現率",
  spawn_dynamics_effect_up: "出現量アップ系の効果",
  score_mult_pool_effect_up: "得点倍率系の効果",
  item_base_score_up: "全アイテムの基礎スコア",
};

export function getDambourlePrize(id: string): DambourleItem | null {
  return DAMBOURLE_PRIZE_BY_ID.get(id) ?? null;
}

export function getDambourlePrizesByRarity(rarity: DambourleRarity): DambourleItem[] {
  return DAMBOURLE_PRIZES.filter((prize) => prize.rarity === rarity);
}

/** ダンボール自身のLvを反映した実効値（%）。No.11とNo.12は0を返す。 */
export function getDambourleEffectPercent(effectKey: DambourleEffectKey, level: number): number {
  const base = DAMBOURLE_EFFECT_BASE_VALUE_PERCENT.get(effectKey);
  if (base == null) return 0;
  return base * (1 + 0.02 * (Math.max(1, level) - 1));
}

/** 選択画面・開始画面・ガチャ結果で共通利用する、現在Lv時点の短い効果説明。 */
export function getDambourleEffectSummary(prize: DambourleItem, level: number): string {
  if (prize.effectKey === "item_skill_level_up") return `全アイテムのスキルLv +${Math.max(1, level)}`;
  if (prize.effectKey === "effect_roulette") return "ラウンド開始時に9種類から1つの効果を抽選";
  const percent = getDambourleEffectPercent(prize.effectKey, level);
  const sign = prize.effectKey === "negative_spawn_down" ? "−" : "+";
  return `${DAMBOURLE_EFFECT_LABELS[prize.effectKey] ?? prize.effectKey} ${sign}${Number(percent.toFixed(1))}%`;
}

/** 効果ルーレット(No.12)の抽選対象。終了時精算系(No.5,6)と永続メタ系(No.11)、
 * ルーレット自身(No.12)は対象外。 */
export const EFFECT_ROULETTE_ELIGIBLE_EFFECT_KEYS: readonly DambourleEffectKey[] = [
  "item_spawn_up",
  "score_mult_up",
  "time_bonus_cutoff_up",
  "box_size_up",
  "negative_spawn_down",
  "time_pool_rate_up",
  "spawn_dynamics_effect_up",
  "score_mult_pool_effect_up",
  "item_base_score_up",
];
