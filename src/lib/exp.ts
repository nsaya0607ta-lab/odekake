export const LEVEL_THRESHOLDS = [
  0, 100, 220, 360, 520, 700, 900, 1120, 1360, 1620,
  1900, 2200, 2520, 2860, 3220, 3600, 4000, 4420, 4860, 5320,
  5800, 6300, 6820, 7360, 7920, 8500, 9100, 9720, 10360, 11020,
] as const;

export type RewardKind = "motion" | "expression" | "accessory" | "room" | "title";

export type LevelReward = {
  level: number;
  name: string;
  kind: RewardKind;
  /** 犬のランダム仕草として実際に追加する画像キー */
  pose?: string;
};

/**
 * Lv.2〜30。すべて犬のモーション／表情の報酬にしてある。
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

/**
 * 歩数EXPがもらえる歩数のライン。
 *
 * supabase/migrations/0009_odekake_exp.sql の record_daily_steps と同じ段階にしてある。
 * EXP を配るのは DB 側なので、ここは「あと何歩で次のEXPか」を表示するためだけに使う。
 * 片方だけ変えると表示と実際の付与がずれるので、必ず両方そろえて直す。
 */
export const STEP_EXP_MILESTONES = [
  1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 12000, 15000, 20000,
] as const;

export type StepProgress = {
  /** 次にEXPがもらえる歩数。すべて到達済みなら null */
  nextMilestone: number | null;
  /** 次のラインまでの残り歩数。すべて到達済みなら null */
  remainingSteps: number | null;
  /** ひとつ前のラインから次のラインまでの進み具合（%） */
  progressPercent: number;
};

/** 今日の歩数から「次の歩数EXPまで」の進み具合を出す */
export function getStepProgress(steps: number | null | undefined): StepProgress {
  const safeSteps = Math.max(0, Math.floor(steps ?? 0));
  const nextMilestone = STEP_EXP_MILESTONES.find((milestone) => safeSteps < milestone) ?? null;

  if (nextMilestone === null) {
    return { nextMilestone: null, remainingSteps: null, progressPercent: 100 };
  }

  const passed = STEP_EXP_MILESTONES.filter((milestone) => milestone <= safeSteps);
  const previousMilestone = passed.at(-1) ?? 0;
  const span = nextMilestone - previousMilestone;

  return {
    nextMilestone,
    remainingSteps: nextMilestone - safeSteps,
    progressPercent: Math.min(100, Math.max(0, ((safeSteps - previousMilestone) / span) * 100)),
  };
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
  const safeTotal = Math.max(0, Math.floor(totalExp));
  let level = 1;

  for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1) {
    if (safeTotal >= LEVEL_THRESHOLDS[index]!) level = index + 1;
    else break;
  }

  const currentLevelExp = LEVEL_THRESHOLDS[level - 1]!;
  const atMaxLevel = level === LEVEL_THRESHOLDS.length;
  const nextLevelExp = atMaxLevel ? LEVEL_THRESHOLDS.at(-1)! : LEVEL_THRESHOLDS[level]!;
  const progressPercent = atMaxLevel
    ? 100
    : Math.min(100, ((safeTotal - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100);

  return {
    level,
    totalExp: safeTotal,
    currentLevelExp,
    nextLevelExp,
    progressPercent,
    nextReward: atMaxLevel ? null : (LEVEL_REWARDS.find((reward) => reward.level === level + 1) ?? null),
  };
}

