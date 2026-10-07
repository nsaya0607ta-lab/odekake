/**
 * ご当地ピンボールの数字（得点・時間・赤コイン）
 * =============================================================
 * ゲーム本体（game.ts）・ルール説明・サーバー（スコアの記録と赤コイン）が同じ値を見る。
 * 赤コインの換算（RED_COIN_*）を変えるときは supabase/migrations の record_pinball_result も同じにする。
 * 1プレイの長さ・得点の分布は scripts/simulate-pinball.mjs で確かめる（結果は docs/pinball.md）。
 */
import type { GachaRarity } from "@/lib/gacha/config";

/** 1ゲームのボールの数 */
export const PINBALL_BALLS = 3;
/** ボールを打ち出してから、落としても戻ってくる時間（秒） */
export const BALL_SAVE_SEC = 8;
/** ボールを出すたびに左のキックバックを点けておく */
export const KICKBACK_AT_SERVE = true;
/** 1プレイで集めるアイテムの数（足りないぶんは？カプセル） */
export const STAMP_COUNT = 8;
/** 台に同時に浮かぶアイテムの数 */
export const LIT_ITEMS = 1;
/** 取られないまま、この秒数がたつと別の場所へうつる */
export const ITEM_RELOCATE_SEC = 20;
/** つぎの大きなショットまでにこの秒数なら「コンボ」 */
export const COMBO_WINDOW_SEC = 4;
export const MAX_COMBO = 5;
/** ボーナス倍率の上限 */
export const MAX_BONUS_X = 6;
/** エクストラボールは1ゲームでここまで */
export const MAX_EXTRA_BALLS = 2;
/** スローモーション中の時間の進み方 */
export const SLOW_SCALE = 0.62;
/** 得点倍率の上限（2倍と3倍が重なっても ×6 まで） */
export const MAX_SCORE_MULT = 6;
/** 県制覇モードで追加するボール（はじめの1球と合わせて3球） */
export const CONQUEST_EXTRA_BALLS = 2;
export const CONQUEST_SAVE_SEC = 12;

/**
 * スキルショット：上のレーン「お・で・か・け」に入りやすい引き量（physics.ts の PLUNGER_CURVE で決まる）。
 * 打ち出しゲージの目印と、シミュレーターのボットが使う。これより強く（FULL_PLUNGE_POWER〜）引くと1周する
 */
export const SKILL_SHOT_POWER: readonly [number, number, number, number] = [0.6, 0.52, 0.41, 0.33];
export const FULL_PLUNGE_POWER = 0.66;

export const POINTS = {
  sling: 110,
  bumper: 1000,
  lane: 1500,
  lanesAll: 25000,
  spinner: 150,
  inlane: 1000,
  outlane: 5000,
  drop: 3000,
  dropsAll: 25000,
  orbit: 15000,
  ramp: 25000,
  scoop: 10000,
  kickback: 5000,
  skillShot: 75000,
  conquest: 500000,
  jackpot: 250000,
  superJackpot: 1000000,
} as const;

/** アイテムを集めたときの得点（県制覇の回数ぶん大きくなる：×(1 + 制覇回数)） */
export const ITEM_POINTS: Record<GachaRarity | "capsule", number> = {
  capsule: 25000,
  N: 30000,
  R: 40000,
  SR: 60000,
  SSR: 80000,
  UR: 120000,
  LR: 200000,
  MR: 300000,
};

/** ボール1つが終わったときのボーナス（ボーナス倍率がかかる） */
export const BONUS = { item: 10000, ramp: 5000, orbit: 4000, bumper: 100, drop: 1000 } as const;

/** ガチャ穴（キックアウトホール）のごほうび。重みつきで1つ出る */
export const GACHA_AWARDS = [
  { id: "points50k", label: "5万点", weight: 25 },
  { id: "points100k", label: "10万点", weight: 12 },
  { id: "save", label: "ボールセーブ 10秒", weight: 14 },
  { id: "kickback", label: "キックバック点灯", weight: 12 },
  { id: "bonusx", label: "ボーナス倍率 +1", weight: 12 },
  { id: "call", label: "アイテムをもう1か所よぶ", weight: 12 },
  { id: "stamp", label: "スタンプ1つプレゼント", weight: 4 },
  { id: "extraBall", label: "エクストラボール", weight: 2 },
] as const;
export type GachaAwardId = (typeof GACHA_AWARDS)[number]["id"];

/**
 * 赤コイン：スコア ÷ RED_COIN_POINTS（切り捨て）、1プレイ RED_COIN_MAX まで。
 * 平均的な腕前（1プレイ約2分）で約200枚になるように決めてある（docs/pinball.md）。
 */
export const RED_COIN_POINTS = 9500;
export const RED_COIN_MAX = 3000;

export function redCoinsForScore(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.min(RED_COIN_MAX, Math.floor(score / RED_COIN_POINTS));
}

/** サーバーで受けつけるスコアの上限（明らかにおかしい値をはじく） */
export const MAX_SCORE = 200_000_000;
/** 1秒あたりにとれる得点の上限の目安（県制覇とジャックポットが続いても届かない大きさ） */
export const MAX_SCORE_PER_SECOND = 400_000;
