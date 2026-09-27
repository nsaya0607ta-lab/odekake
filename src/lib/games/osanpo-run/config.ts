/**
 * おさんぽフレンチー（ミニゲーム）の設定
 * =============================================================
 * 横スクロールで障害物をジャンプ・スライディングでかわしながら、
 * 自分が持っている図鑑アイテムを拾っていくゲーム。
 * ステージ・レアリティごとの点数・称号・BGMの譜面などをここにまとめる。
 * 描画と進行は src/components/games/osanpo-run/engine.ts。
 */
import type { GachaRarity } from "@/lib/gacha/config";
import type { DogSkinId } from "@/lib/dog-skins";

export const OSANPO_RUN_STAGE_IDS = ["town", "hiking", "snow", "summer"] as const;
export type OsanpoRunStageId = (typeof OSANPO_RUN_STAGE_IDS)[number];

export type OsanpoRunStage = {
  id: OsanpoRunStageId;
  name: string;
  /** ステージ選択に出す紹介文 */
  desc: string;
  /** 犬スキン。季節ステージはそのスキンを持っていると遊べる */
  skin: DogSkinId;
  skinName: string;
  /** スタート時刻（0時からの分） */
  clock: number;
  /** このステージで出やすくなる図鑑シリーズ */
  series: string | null;
  weather: "rain" | "snow";
};

export const OSANPO_RUN_STAGES: Record<OsanpoRunStageId, OsanpoRunStage> = {
  town: {
    id: "town",
    name: "まち",
    desc: "夕方5時20分、いつもの住宅街。電柱と自販機の並ぶ道を、日が暮れて星が出るまで。",
    skin: "default",
    skinName: "いつものフレブル",
    clock: 17 * 60 + 20,
    series: null,
    weather: "rain",
  },
  hiking: {
    id: "hiking",
    name: "山道",
    desc: "夜明け前の山道。朝日が昇るなか山頂を目指す。岩や倒木、低く張り出した枝に気をつけて。",
    skin: "hiking",
    skinName: "登山のフレブル",
    clock: 5 * 60 + 40,
    series: "hiking",
    weather: "rain",
  },
  snow: {
    id: "snow",
    name: "雪国",
    desc: "雪の降る午後の町。雪だるまやソリ、軒先のつららをかわしながら、凍った道を進む。",
    skin: "snow",
    skinName: "雪国のフレブル",
    clock: 15 * 60 + 10,
    series: "snow",
    weather: "snow",
  },
  summer: {
    id: "summer",
    name: "夏まつり",
    desc: "夏まつりの夕暮れ。屋台と提灯の参道を歩いていくと、夜には花火が上がる。",
    skin: "summer",
    skinName: "夏のフレブル",
    clock: 18 * 60 + 30,
    series: "summer",
    weather: "rain",
  },
};

export function isOsanpoRunStageId(value: unknown): value is OsanpoRunStageId {
  return typeof value === "string" && (OSANPO_RUN_STAGE_IDS as readonly string[]).includes(value);
}

export type RarityStyle = {
  /** 1個あたりの点数（コンボ倍率がさらに掛かる） */
  points: number;
  /** 出現の重み */
  weight: number;
  color: string;
  /** 光のにじみの色（"r,g,b"）。N は光らせない */
  glow: string | null;
};

export const RARITY_STYLES: Record<GachaRarity, RarityStyle> = {
  N: { points: 10, weight: 44, color: "#D9D3EE", glow: null },
  R: { points: 20, weight: 28, color: "#7CC4FF", glow: "124,196,255" },
  SR: { points: 40, weight: 14, color: "#C79BFF", glow: "199,155,255" },
  SSR: { points: 80, weight: 8, color: "#FFC857", glow: "255,200,87" },
  UR: { points: 150, weight: 4, color: "#FF84BC", glow: "255,132,188" },
  LR: { points: 300, weight: 1.4, color: "#7EF0D0", glow: "126,240,208" },
  MR: { points: 500, weight: 0.6, color: "#FFFFFF", glow: "255,255,255" },
};

/** LR・MR を拾うと、一度だけ衝突を防ぐバリアが付く */
export function isBarrierRarity(rarity: GachaRarity): boolean {
  return rarity === "LR" || rarity === "MR";
}

export type OsanpoRunAchievement = { id: string; name: string; condition: string };

export const OSANPO_RUN_ACHIEVEMENTS: readonly OsanpoRunAchievement[] = [
  { id: "first", name: "はじめの一歩", condition: "はじめてのおさんぽを終える" },
  { id: "m100", name: "ご近所さんぽ", condition: "1回で100m歩く" },
  { id: "m500", name: "ちょっと遠出", condition: "1回で500m歩く" },
  { id: "m1000", name: "健脚フレブル", condition: "1回で1000m歩く" },
  { id: "rain", name: "雨にも負けず", condition: "雨か雪の中を20秒歩く" },
  { id: "night", name: "夜ふかし散歩", condition: "夜9時を過ぎても歩き続ける" },
  { id: "rush", name: "ラッシュ突破", condition: "ラッシュを乗り切る" },
  { id: "rush3", name: "ラッシュの鬼", condition: "1回で3回ラッシュを乗り切る" },
  { id: "bonus15", name: "ボーナスハンター", condition: "1回のボーナスタイムで15個拾う" },
  { id: "combo5", name: "コンボ職人", condition: "×5コンボを出す" },
  { id: "close5", name: "ギリギリの達人", condition: "1回で「ギリギリ！」を5回出す" },
  { id: "pigeon10", name: "ハトとなかよし", condition: "ハトを飛び立たせる（累計10回）" },
  { id: "slide10", name: "スライディング名人", condition: "スライディングでくぐる（累計10回）" },
  { id: "barrier", name: "おまもり効果", condition: "バリアで助かる" },
  { id: "mr", name: "幻の一品", condition: "MRのアイテムを拾う" },
  { id: "kinds50", name: "コレクター", condition: "アイテムを50種類拾う（累計）" },
  { id: "kindsAll", name: "ぜんぶ拾った", condition: "持っているアイテムをすべて拾う（累計）" },
  { id: "hiking", name: "山道マスター", condition: "山道で300m歩く" },
  { id: "snow", name: "雪国マスター", condition: "雪国で300m歩く" },
  { id: "summer", name: "夏まつりマスター", condition: "夏まつりで300m歩く" },
  // ---- 追加した障害物・スキルの称号 ----
  { id: "roller10", name: "おそうじロボの天敵", condition: "転がってくるものを跳び越える（累計10回）" },
  { id: "drop10", name: "頭上注意", condition: "上から落ちてくるものをよける（累計10回）" },
  { id: "greet20", name: "ごあいさつ上手", condition: "ほかのフレブルにあいさつする（累計20回）" },
  { id: "geyser10", name: "びしょぬれ回避", condition: "水が出ているところを通り抜ける（累計10回）" },
  { id: "bones100", name: "ほね職人", condition: "1回でほねを100本拾う" },
  { id: "skills10", name: "スキルマニア", condition: "1回で10種類のスキルを発動させる" },
  { id: "knock10", name: "ブルドーザー", condition: "1回で無敵中に障害物を10個吹っ飛ばす" },
  { id: "rare3", name: "引きが強い", condition: "1回でUR以上のアイテムを3個拾う" },
  { id: "survive180", name: "3分間のおさんぽ", condition: "1回で3分間歩き続ける" },
  { id: "quick", name: "おさんぽ終了のおしらせ", condition: "歩き出して5秒以内にぶつかる" },
  { id: "kiriban", name: "キリ番ゲッター", condition: "スコアがちょうど100の倍数で帰る" },
  { id: "dawn", name: "朝帰り", condition: "朝の5時まで歩き続ける" },
];

/** 結果画面のひとこと。スコアがしきい値以上の中で一番大きいものを出す */
export const OSANPO_RUN_COMMENTS: readonly (readonly [number, string])[] = [
  [0, "電柱ひとつ分でもう満足した顔をしている。"],
  [200, "まだ帰りたくなくて、玄関の前で踏ん張っている。"],
  [600, "いい散歩だった。短いしっぽがちぎれそうなくらい揺れている。"],
  [1200, "近所のカラスに顔を覚えられた。"],
  [2200, "拾ったアイテムで小屋がいっぱい。図鑑コンプの顔をしている。"],
  [3500, "町内でいちばん健脚なフレブル。帰ったら即、へそ天でいびき。"],
];

export const OSANPO_RUN_RANKS: readonly { min: number; label: string; color: string }[] = [
  { min: 35000, label: "SS", color: "#FF84BC" },
  { min: 20000, label: "S", color: "#FFC857" },
  { min: 10000, label: "A", color: "#7EF0D0" },
  { min: 5000, label: "B", color: "#7CC4FF" },
  { min: 0, label: "C", color: "#ABA5CF" },
];

export const OSANPO_RUN_HINTS = {
  jump: "タップでジャンプ！ 長押しで高く",
  dj: "空中でもう一回タップで2段ジャンプ",
  crow: "カラスは跳ばずに、下をくぐろう",
  cat: "猫はこっちに歩いてくる。早めに跳ぼう",
  slide: "↓キーか下スワイプでスライディング！",
  roller: "こっちに転がってくる。早めに跳ぼう",
  drop: "地面に影！ 上から何か落ちてくる",
  buddy: "ほかのフレブルはぶつかってもOK。ごあいさつすると点がもらえる",
  geyser: "水が止まった瞬間に通るか、2段ジャンプで越えよう",
} as const;
export type OsanpoRunHintId = keyof typeof OSANPO_RUN_HINTS;

export type Song = {
  bpm: number;
  lead: OscillatorType;
  level: number;
  kit: "pop" | "folk" | "bell" | "matsuri";
  roots: readonly [number, number, number, number];
  /** 16分音符×64ステップのメロディ（MIDIノート番号。0は休符） */
  melody: readonly number[];
};

export const OSANPO_RUN_SONGS: Record<OsanpoRunStageId, Song> = {
  town: {
    bpm: 120, lead: "square", level: 0.035, kit: "pop", roots: [48, 45, 41, 43],
    melody: [
      72, 0, 76, 0, 79, 0, 76, 0, 81, 0, 79, 0, 76, 0, 74, 0, 76, 0, 72, 0, 69, 0, 72, 0, 76, 0, 74, 0, 72, 0, 0, 0,
      69, 0, 72, 0, 77, 0, 76, 0, 74, 0, 72, 0, 69, 0, 72, 0, 74, 0, 79, 0, 77, 0, 76, 0, 74, 0, 71, 0, 74, 0, 0, 0,
    ],
  },
  hiking: {
    bpm: 112, lead: "triangle", level: 0.075, kit: "folk", roots: [43, 48, 50, 43],
    melody: [
      67, 0, 71, 0, 74, 0, 71, 0, 72, 0, 71, 0, 69, 0, 67, 0, 64, 0, 67, 0, 72, 0, 71, 0, 69, 0, 67, 0, 64, 0, 0, 0,
      66, 0, 69, 0, 74, 0, 72, 0, 71, 0, 69, 0, 66, 0, 69, 0, 71, 0, 74, 0, 79, 0, 76, 0, 74, 0, 71, 0, 67, 0, 0, 0,
    ],
  },
  snow: {
    bpm: 92, lead: "sine", level: 0.07, kit: "bell", roots: [45, 41, 48, 43],
    melody: [
      76, 0, 0, 0, 72, 0, 69, 0, 72, 0, 76, 0, 81, 0, 0, 0, 77, 0, 0, 0, 76, 0, 72, 0, 69, 0, 72, 0, 77, 0, 0, 0,
      76, 0, 0, 0, 79, 0, 76, 0, 72, 0, 74, 0, 76, 0, 0, 0, 74, 0, 0, 0, 71, 0, 67, 0, 71, 0, 74, 0, 79, 0, 0, 0,
    ],
  },
  summer: {
    bpm: 124, lead: "triangle", level: 0.07, kit: "matsuri", roots: [50, 43, 45, 50],
    melody: [
      74, 0, 74, 76, 79, 0, 76, 0, 74, 0, 71, 0, 74, 0, 0, 0, 79, 0, 79, 81, 83, 0, 81, 0, 79, 0, 76, 0, 74, 0, 0, 0,
      76, 0, 79, 0, 81, 0, 79, 76, 74, 0, 76, 0, 71, 0, 69, 0, 71, 0, 74, 0, 76, 0, 79, 0, 76, 0, 74, 0, 74, 0, 0, 0,
    ],
  },
};

/** localStorage のキー接頭辞。記録はこの端末にだけ保存する */
export const OSANPO_RUN_STORAGE_PREFIX = "odekake:osanpo-run:";
