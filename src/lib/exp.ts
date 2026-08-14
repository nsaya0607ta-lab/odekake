/** Lv.1〜30 は公開済みの成長カーブをそのまま維持する。 */
export const LEVEL_THRESHOLDS = [
  0, 100, 220, 360, 520, 700, 900, 1120, 1360, 1620,
  1900, 2200, 2520, 2860, 3220, 3600, 4000, 4420, 4860, 5320,
  5800, 6300, 6820, 7360, 7920, 8500, 9100, 9720, 10360, 11020,
] as const;

export const LAST_MOTION_REWARD_LEVEL = 30;
export const LEVEL_30_TOTAL_EXP = LEVEL_THRESHOLDS[LAST_MOTION_REWARD_LEVEL - 1];

export type RewardKind = "motion" | "expression" | "accessory" | "room" | "title";

export type LevelReward = {
  level: number;
  name: string;
  kind: RewardKind;
  /** 犬のランダム仕草として実際に追加する画像キー */
  pose?: string;
};

/**
 * Lv.2〜30。ここまでは犬のモーション／表情も解放する。
 * Lv.31以降はレベル上限なしで、レベルアップ報酬はコインのみ。
 *
 * `pose` は src/components/wandering-frenchie.tsx の MOTIONS の id と必ず同じにする。
 * Lv.1 からある基本動作（stand / walk / sit / sniff / happy / shake / sleep）とは
 * 重複させない。
 */
export const LEVEL_REWARDS: readonly LevelReward[] = [
  { level: 2, name: "首をかしげる", kind: "motion", pose: "tilt" },
  { level: 3, name: "お手", kind: "motion", pose: "paw" },
  { level: 4, name: "ハイタッチ", kind: "motion", pose: "highfive" },
  { level: 5, name: "ウインク", kind: "expression", pose: "wink" },
  { level: 6, name: "にっこり", kind: "expression", pose: "grin" },
  { level: 7, name: "びっくり", kind: "expression", pose: "surprise" },
  { level: 8, name: "いないいないばあ", kind: "motion", pose: "peekaboo" },
  { level: 9, name: "くるっとターン", kind: "motion", pose: "spin" },
  { level: 10, name: "二足立ち", kind: "motion", pose: "standup" },
  { level: 11, name: "小ジャンプ", kind: "motion", pose: "hop" },
  { level: 12, name: "しゃっくり", kind: "expression", pose: "hiccup" },
  { level: 13, name: "しっぽフリフリ", kind: "motion", pose: "tailwag" },
  { level: 14, name: "耳ぴくぴく", kind: "expression", pose: "earflick" },
  { level: 15, name: "キョロキョロ", kind: "expression", pose: "lookaround" },
  { level: 16, name: "前足ちょいちょい", kind: "motion", pose: "pawtap" },
  { level: 17, name: "おしりフリフリ", kind: "motion", pose: "hipwiggle" },
  { level: 18, name: "のび〜っ", kind: "motion", pose: "stretch" },
  { level: 19, name: "ふりむく", kind: "motion", pose: "lookback" },
  { level: 20, name: "おじぎ", kind: "motion", pose: "bowing" },
  { level: 21, name: "前足バタバタ", kind: "motion", pose: "pawflail" },
  { level: 22, name: "顔かくし", kind: "motion", pose: "hideface" },
  { level: 23, name: "片足あげ", kind: "motion", pose: "onepaw" },
  { level: 24, name: "後ずさり", kind: "motion", pose: "backstep" },
  { level: 25, name: "くしゃみ", kind: "expression", pose: "sneeze" },
  { level: 26, name: "遠吠え", kind: "motion", pose: "howl" },
  { level: 27, name: "左右ステップ", kind: "motion", pose: "sidestep" },
  { level: 28, name: "首ぶんぶん", kind: "motion", pose: "headshake" },
  { level: 29, name: "前足クロス", kind: "motion", pose: "pawcross" },
  { level: 30, name: "うれしいダンス", kind: "motion", pose: "dance" },
] as const;

/** そのレベルへ上がるために、直前のレベルから必要なEXP。 */
export function getRequiredExpForLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  const target = Math.floor(level);
  if (target < 2) return 0;

  if (target <= LAST_MOTION_REWARD_LEVEL) {
    return LEVEL_THRESHOLDS[target - 1]! - LEVEL_THRESHOLDS[target - 2]!;
  }

  // Lv.31 = 700。以降は1レベルごとに +50EXP。
  return 700 + 50 * (target - 31);
}

/** そのレベルに到達するために必要な累計EXP。 */
export function getTotalExpForLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  const target = Math.max(1, Math.floor(level));
  if (target <= 1) return 0;
  if (target <= LAST_MOTION_REWARD_LEVEL) return LEVEL_THRESHOLDS[target - 1]!;

  const levelsAfter30 = target - LAST_MOTION_REWARD_LEVEL;
  // 700 + 750 + ... を等差数列で足す。
  return LEVEL_30_TOTAL_EXP + 700 * levelsAfter30 + 25 * levelsAfter30 * (levelsAfter30 - 1);
}

/** 累計EXPからレベルを求める。Lv.30以降も上限を設けない。 */
export function getLevelFromTotalExp(totalExp: number): number {
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(totalExp) ? totalExp : 0));

  if (safeTotal < LEVEL_30_TOTAL_EXP) {
    let level = 1;
    for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1) {
      if (safeTotal >= LEVEL_THRESHOLDS[index]!) level = index + 1;
      else break;
    }
    return level;
  }

  const delta = safeTotal - LEVEL_30_TOTAL_EXP;
  // Lv.30+n の追加必要EXP = 25n^2 + 675n。
  const estimate = Math.floor((-675 + Math.sqrt(675 * 675 + 100 * delta)) / 50);
  let level = LAST_MOTION_REWARD_LEVEL + Math.max(0, estimate);

  // 浮動小数点の丸め誤差が境界で出ても必ず正しいレベルへ補正する。
  while (getTotalExpForLevel(level + 1) <= safeTotal) level += 1;
  while (level > 1 && getTotalExpForLevel(level) > safeTotal) level -= 1;
  return level;
}

export type ExpProgress = {
  level: number;
  totalExp: number;
  currentLevelExp: number;
  nextLevelExp: number;
  progressPercent: number;
  nextReward: LevelReward | null;
};

export function getExpProgress(totalExp: number): ExpProgress {
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(totalExp) ? totalExp : 0));
  const level = getLevelFromTotalExp(safeTotal);
  const currentLevelExp = getTotalExpForLevel(level);
  const nextLevelExp = getTotalExpForLevel(level + 1);
  const progressPercent = Math.min(
    100,
    ((safeTotal - currentLevelExp) / Math.max(1, nextLevelExp - currentLevelExp)) * 100,
  );

  return {
    level,
    totalExp: safeTotal,
    currentLevelExp,
    nextLevelExp,
    progressPercent,
    nextReward: LEVEL_REWARDS.find((reward) => reward.level === level + 1) ?? null,
  };
}
