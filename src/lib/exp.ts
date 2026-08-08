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

/** Lv.2〜30。初期7モーションとは重複させない。 */
export const LEVEL_REWARDS: readonly LevelReward[] = [
  { level: 2, name: "ウインク", kind: "expression", pose: "wink" },
  { level: 3, name: "おててを振る", kind: "motion", pose: "wave" },
  { level: 4, name: "若葉の首輪", kind: "accessory" },
  { level: 5, name: "カメラポーズ", kind: "motion", pose: "camera" },
  { level: 6, name: "お花のバンダナ", kind: "accessory" },
  { level: 7, name: "おじぎ", kind: "motion", pose: "bow" },
  { level: 8, name: "称号「旅のはじまり」", kind: "title" },
  { level: 9, name: "おでかけリュック", kind: "accessory" },
  { level: 10, name: "全力で喜ぶ", kind: "motion", pose: "cheer" },
  { level: 11, name: "夕焼けの首輪", kind: "accessory" },
  { level: 12, name: "にっこり笑顔", kind: "expression", pose: "smile" },
  { level: 13, name: "ふかふかクッション", kind: "room" },
  { level: 14, name: "地面をカリカリ", kind: "motion", pose: "dig" },
  { level: 15, name: "青空のバンダナ", kind: "accessory" },
  { level: 16, name: "おやつ待ち", kind: "motion", pose: "treat" },
  { level: 17, name: "称号「まち探検家」", kind: "title" },
  { level: 18, name: "麦わら帽子", kind: "accessory" },
  { level: 19, name: "ごろごろ", kind: "motion", pose: "roll" },
  { level: 20, name: "お水を飲む", kind: "motion", pose: "drink" },
  { level: 21, name: "星空の首輪", kind: "accessory" },
  { level: 22, name: "うとうと", kind: "motion", pose: "doze" },
  { level: 23, name: "旅の写真立て", kind: "room" },
  { level: 24, name: "大あくび", kind: "expression", pose: "yawn" },
  { level: 25, name: "探検家リュック", kind: "accessory" },
  { level: 26, name: "寝ころび手振り", kind: "motion", pose: "lieWave" },
  { level: 27, name: "キャプテン帽", kind: "accessory" },
  { level: 28, name: "日本地図ラグ", kind: "room" },
  { level: 29, name: "称号「日本めぐり名人」", kind: "title" },
  { level: 30, name: "旅王のクラウン", kind: "accessory" },
] as const;

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

