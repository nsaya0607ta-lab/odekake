/**
 * ご当地ピンボールの数字（得点・時間・青コイン）
 * =============================================================
 * ゲーム本体（game.ts）・ルール説明・サーバー（スコアの記録と青コイン）が同じ値を見る。
 * 青コインの換算（COIN_POINTS・COIN_MAX）を変えるときは supabase/migrations の record_pinball_result も同じにする。
 * 1プレイの長さ・得点の分布は scripts/simulate-pinball.mjs で確かめる（結果は docs/pinball.md）。
 */
import type { GachaRarity } from "@/lib/gacha/config";

/** 1ゲームのボールの数 */
export const PINBALL_BALLS = 3;
/**
 * 玉の速さ（台の上の時間の進み方）。1 だと本物の台と同じ速さで、スマホの画面では目で追いにくいので、
 * 少しゆっくりにしてある。物理（玉・フリッパー・バンパー）だけが遅くなり、ボールセーブなどの秒数は実際の秒のまま。
 * 形・強さの調整（打ち出しの強さ・フリッパーの狙い）は変わらないので、ここだけで速さを変えられる
 */
export const GAME_SPEED = 0.75;
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
/** 制覇モードで追加するボール（はじめの1球と合わせて3球） */
export const CONQUEST_EXTRA_BALLS = 2;
export const CONQUEST_SAVE_SEC = 12;

/**
 * 図鑑ボーナス：ご当地アイテム（台に出るもの。全部の県）を何種類持っているかで、すべての得点にかける倍率。
 * 持っている割合 × ZUKAN_BONUS_MAX だけ上がり、全部そろえると 1 + ZUKAN_BONUS_MAX 倍（1つも持っていなければ 1 倍）
 */
export const ZUKAN_BONUS_MAX = 0.1;

export function zukanBonus(owned: number, total: number): number {
  if (total <= 0 || owned <= 0) return 1;
  return Math.round((1 + ZUKAN_BONUS_MAX * Math.min(1, owned / total)) * 100) / 100;
}

/**
 * 限界突破（★）：スキルLvが MAX になったあとも同じアイテムを引くと、1つごとに★が1つ（STAR_MAX まで）。
 * ★1つで、そのアイテムのスキルの秒数・得点と、アイテムを取ったときの得点が STAR_RATE ずつ上がる
 */
export const STAR_MAX = 5;
export const STAR_RATE = 0.05;
/** スキル「おかわり」で台にもう一度出たアイテムは、この秒数で消える。取ったときの得点はふつうの ENCORE_POINTS 倍 */
export const ENCORE_SEC = 30;
export const ENCORE_POINTS = 0.5;

/**
 * スキルショット：上のレーン「お・で・か・け」に入りやすい引き量（physics.ts の PLUNGER_CURVE で決まる）。
 * 打ち出しゲージの目印と、シミュレーターのボットが使う。これより強く（FULL_PLUNGE_POWER〜）引くと1周する
 */
export const SKILL_SHOT_POWER: readonly [number, number, number, number] = [0.6, 0.515, 0.43, 0.335];
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
  standup: 3000,
  standupsAll: 30000,
  pinwheel: 500,
  skillShot: 75000,
  conquest: 500000,
  jackpot: 250000,
  superJackpot: 1000000,
  /** スキル「おかわり」で、もう一度出せるアイテムが無かったとき */
  encoreMiss: 30000,
} as const;

/** アイテムを集めたときの得点（制覇の回数ぶん大きくなる：×(1 + 制覇回数)） */
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
 * 青コイン：スコア ÷ COIN_POINTS（切り捨て）、1プレイ COIN_MAX まで。
 * はじめは赤コイン（スコア ÷ 9,500・3,000枚まで）だったが、赤コインはやめて青コインにし、枚数は8割にした
 * （9,500 ÷ 0.8 = 11,875、3,000 × 0.8 = 2,400）。平均的な腕前で約160枚（docs/pinball.md）。
 */
export const COIN_POINTS = 11875;
export const COIN_MAX = 2400;

export function coinsForScore(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.min(COIN_MAX, Math.floor(score / COIN_POINTS));
}

/** サーバーで受けつけるスコアの上限（明らかにおかしい値をはじく） */
export const MAX_SCORE = 200_000_000;
/** 1秒あたりにとれる得点の上限の目安（制覇とジャックポットが続いても届かない大きさ） */
export const MAX_SCORE_PER_SECOND = 400_000;
