/**
 * わんこボウリングで選べるマイボール
 * =============================================================
 * 図鑑・ガチャの既存アイテムIDのうち「ボール」系だけを対象にする。
 * 基本は公平性のため性能（速度・当たり判定・スコア期待値）を全ボール共通にし、
 * レアリティによる違いは見た目の演出だけに限定する。
 * ただしゴールドボールのみ、重量・最高速度が異なる特別な物理設定を持つ。
 */

import type { GachaRarity } from "@/lib/gacha/config";
import { COLLECTION_ITEMS } from "@/lib/collection/items";
import { LB_TO_KG } from "@/lib/games/wanko-bowling-physics";

export type BowlingBallVisual = {
  itemId: string;
  /** 投球中の軌跡の色 */
  trailColor: string;
  /** ボール本体のグラデーション（内側→外側） */
  bodyGradient: [string, string];
  /** ピンヒット時のスパークの色 */
  hitColor: string;
  /** ストライク演出を少し豪華にするか */
  premiumEffect: boolean;
  /** プレイ中に表示するボールの実画像（未設定ならグラデーションのみ） */
  image: string | null;
  /** ボールの質量（kg）。未指定ならGAME_BALL_MASS_KG（標準球）を使う。 */
  massKg?: number;
  /** リリース最高速度（km/h）。未指定ならGAME_MAX_BALL_SPEED_KMH（標準球）を使う。 */
  maxSpeedKmh?: number;
};

function imageForItem(itemId: string): string | null {
  return COLLECTION_ITEMS.find((item) => item.id === itemId)?.image ?? null;
}

export const BOWLING_BALL_ITEM_IDS = [
  "toy_colorful_ball",
  "toy_squeaky_ball",
  "toy_tennis_ball",
  "toy_soccer_ball",
  "toy_rainbow_ball",
  "toy_golden_crown_ball",
  "interior_gold_ball",
] as const;

export type BowlingBallItemId = (typeof BOWLING_BALL_ITEM_IDS)[number];

export const DEFAULT_BOWLING_BALL_ID = "default_paw_ball" as const;

const BALL_VISUALS: Record<string, BowlingBallVisual> = {
  [DEFAULT_BOWLING_BALL_ID]: {
    itemId: DEFAULT_BOWLING_BALL_ID,
    trailColor: "#c9a06a",
    bodyGradient: ["#fbeed7", "#c9a06a"],
    hitColor: "#e7c98f",
    premiumEffect: false,
    image: null,
  },
  toy_colorful_ball: {
    itemId: "toy_colorful_ball",
    trailColor: "#e08a9a",
    bodyGradient: ["#fff2ea", "#e08a9a"],
    hitColor: "#ffb6c6",
    premiumEffect: false,
    image: imageForItem("toy_colorful_ball"),
  },
  toy_squeaky_ball: {
    itemId: "toy_squeaky_ball",
    trailColor: "#7fa8c9",
    bodyGradient: ["#eef6fb", "#7fa8c9"],
    hitColor: "#a8d4f0",
    premiumEffect: false,
    image: imageForItem("toy_squeaky_ball"),
  },
  toy_tennis_ball: {
    itemId: "toy_tennis_ball",
    trailColor: "#a9c94a",
    bodyGradient: ["#f5fadd", "#a9c94a"],
    hitColor: "#d7ee8a",
    premiumEffect: false,
    image: imageForItem("toy_tennis_ball"),
  },
  toy_soccer_ball: {
    itemId: "toy_soccer_ball",
    trailColor: "#4a4a4a",
    bodyGradient: ["#ffffff", "#c9c9c9"],
    hitColor: "#e5e5e5",
    premiumEffect: false,
    image: imageForItem("toy_soccer_ball"),
  },
  toy_rainbow_ball: {
    itemId: "toy_rainbow_ball",
    trailColor: "conic-gradient(from 0deg, #e08a9a, #e0b862, #a9c94a, #7fa8c9, #a99bcb, #e08a9a)",
    bodyGradient: ["#ffffff", "#a99bcb"],
    hitColor: "#ffe08a",
    premiumEffect: true,
    image: imageForItem("toy_rainbow_ball"),
  },
  toy_golden_crown_ball: {
    itemId: "toy_golden_crown_ball",
    trailColor: "#e0b862",
    bodyGradient: ["#fff6d8", "#c99a34"],
    hitColor: "#ffd766",
    premiumEffect: true,
    image: imageForItem("toy_golden_crown_ball"),
  },
  interior_gold_ball: {
    itemId: "interior_gold_ball",
    trailColor: "#f0c25c",
    bodyGradient: ["#fff2c4", "#b8860b"],
    hitColor: "#ffe08a",
    premiumEffect: true,
    image: imageForItem("interior_gold_ball"),
    // 9lb相当。標準球（約15lb）よりかなり軽く、代わりに最高速度を抑える。
    massKg: 9 * LB_TO_KG,
    maxSpeedKmh: 35,
  },
};

export function getBowlingBallVisual(itemId: string | null | undefined): BowlingBallVisual {
  if (itemId && BALL_VISUALS[itemId]) return BALL_VISUALS[itemId];
  return BALL_VISUALS[DEFAULT_BOWLING_BALL_ID]!;
}

export type OwnedBowlingBall = {
  id: string;
  name: string;
  image: string | null;
  rarity: GachaRarity | null;
};
