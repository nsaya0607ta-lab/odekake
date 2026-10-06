/**
 * 起動画面（grand-splash.tsx）で使う決まった値。
 * 画像は public/splash/ に、起動画面のためだけに小さく作りなおしたものを置いている
 * （図鑑の高レア画像は 1 枚 270KB ほどあるので、そのままは使わない）。
 */

/** 空の色。端末の時刻で決める */
export type SkyPhase = "morning" | "day" | "evening" | "night";

export function skyPhaseOf(date: Date): SkyPhase {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 5 && h < 9) return "morning";
  if (h >= 9 && h < 16) return "day";
  if (h >= 16 && h < 19) return "evening";
  return "night";
}

/** お天気（太陽・月をタップすると、この順にかわる） */
export const WEATHERS = ["clear", "sakura", "rain", "snow"] as const;
export type Weather = (typeof WEATHERS)[number];
export const WEATHER_LABEL: Record<Weather, string> = { clear: "はれ", sakura: "さくら", rain: "あめ", snow: "ゆき" };

/**
 * 地図のピン（public/splash/japan.webp の幅・高さに対する％）。
 * 画像は src/lib/geo の全国地図を描いたもので、位置は各都道府県の中心から出した
 */
export const MAP_PINS = [
  { code: "01", name: "北海道", x: 81.5, y: 15.1 },
  { code: "04", name: "宮城県", x: 71.2, y: 47.0 },
  { code: "13", name: "東京都", x: 62.3, y: 65.9 },
  { code: "20", name: "長野県", x: 55.2, y: 62.7 },
  { code: "21", name: "岐阜県", x: 50.9, y: 63.1 },
  { code: "26", name: "京都府", x: 41.8, y: 69.5 },
  { code: "34", name: "広島県", x: 27.3, y: 72.6 },
  { code: "40", name: "福岡県", x: 14.7, y: 79.4 },
] as const;

/** 地図の画像の縦横比（幅 ÷ 高さ） */
export const MAP_RATIO = 640 / 668;

export type Rarity = "N" | "R" | "SR" | "SSR" | "UR" | "LR" | "MR";

/** ガチャから出る図鑑アイテム（public/splash/items/） */
export const GACHA_ITEMS: readonly { id: string; name: string; rarity: Rarity }[] = [
  { id: "bone-toy", name: "ほねのおもちゃ", rarity: "N" },
  { id: "duck-plush", name: "あひるのぬいぐるみ", rarity: "R" },
  { id: "carrot-toy", name: "にんじんトイ", rarity: "R" },
  { id: "frisbee", name: "フリスビー", rarity: "R" },
  { id: "paw-food-bowl", name: "肉球フードボウル", rarity: "R" },
  { id: "frenchie-plush", name: "フレブルぬいぐるみ", rarity: "SR" },
  { id: "treasure-puzzle", name: "宝箱おやつパズル", rarity: "SR" },
  { id: "rainbow-ball", name: "虹色わんこボール", rarity: "SSR" },
  { id: "golden-crown-ball", name: "王冠つき黄金ボール", rarity: "SSR" },
  { id: "gold-ball", name: "ゴールドボール", rarity: "SSR" },
  { id: "mocchurin", name: "もっちゅりん", rarity: "UR" },
  { id: "anball", name: "アンボール", rarity: "UR" },
  { id: "okaeri", name: "おかえり", rarity: "LR" },
  { id: "pink-omo", name: "ピンクオモ", rarity: "LR" },
  { id: "burebur", name: "ブレブル", rarity: "MR" },
  { id: "xmas-party", name: "Xmas Party", rarity: "MR" },
];

/** 起動画面のガチャの出やすさ（遊び用。本物のガチャの排出率とは別） */
export const RARITY_WEIGHT: Record<Rarity, number> = { N: 26, R: 30, SR: 20, SSR: 14, UR: 6.5, LR: 3, MR: 0.5 };

/** レア度の色（帯の色・うしろの光の色） */
export const RARITY_COLOR: Record<Rarity, { band: string; glow: string; text: string }> = {
  N: { band: "#b9b0a2", glow: "rgba(255,255,255,.7)", text: "#fff" },
  R: { band: "#5ea8dc", glow: "rgba(140,200,255,.85)", text: "#fff" },
  SR: { band: "#e8a838", glow: "rgba(255,210,110,.9)", text: "#fff" },
  SSR: { band: "#e2557f", glow: "rgba(255,150,190,.95)", text: "#fff" },
  UR: { band: "#c43c3c", glow: "rgba(255,120,110,.95)", text: "#fff" },
  LR: { band: "#3b2f22", glow: "rgba(255,215,90,1)", text: "#ffd75a" },
  MR: { band: "#1d1852", glow: "rgba(190,160,255,1)", text: "#ffd75a" },
};

export function drawGachaItem(): (typeof GACHA_ITEMS)[number] {
  const total = Object.values(RARITY_WEIGHT).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let rarity: Rarity = "N";
  for (const [key, weight] of Object.entries(RARITY_WEIGHT) as [Rarity, number][]) {
    r -= weight;
    if (r <= 0) {
      rarity = key;
      break;
    }
  }
  const pool = GACHA_ITEMS.filter((item) => item.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)] ?? GACHA_ITEMS[0]!;
}

/** 犬をタップしたときの仕草（順番に変わる）と、そのときに出るもの */
export const DOG_REACTIONS = [
  { pose: "cheer", fx: "heart", say: "わーい！" },
  { pose: "wave", fx: "sparkle", say: "やっほー！" },
  { pose: "wink", fx: "sparkle", say: "えへへ" },
  { pose: "bark", fx: "note", say: "ワン！" },
  { pose: "stand-happy", fx: "heart", say: "おでかけ たのしみ！" },
] as const;

/** 写真（SNS・記録）。タップすると裏返って「いいね」がふえる */
export const POLAROIDS = [
  { id: "osanpo", src: "/splash/photo-osanpo.webp", caption: "夕方のおさんぽ", likes: 12, tilt: -7 },
  { id: "field", src: "/splash/photo-field.webp", caption: "ひろばで ひとやすみ", likes: 28, tilt: 4 },
  { id: "snack", src: "/splash/photo-snack.webp", caption: "おやつ はっけん！", likes: 19, tilt: -3 },
] as const;

/** ミニゲームの道しるべ */
export const GAME_SIGNS = [
  { id: "catch", label: "アイテムキャッチ", lines: ["アイテム", "キャッチ"], icon: "/splash/game-item-catch.webp", say: "ダンボールでキャッチ！" },
  { id: "bowling", label: "わんこボウリング", lines: ["わんこ", "ボウリング"], icon: "/splash/game-bowling.webp", say: "ストライク ねらおう！" },
] as const;

/** 夜空の星（位置は決め打ち。描きなおしても同じ場所に出る） */
export const STARS: readonly [number, number, number][] = Array.from({ length: 34 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  const x = (a - Math.floor(a)) * 100;
  const y = (b - Math.floor(b)) * 46;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10, (i % 5) * 0.6];
});

/** 天気の粒（雨・雪・花びら）。こちらも決め打ちの位置 */
export const WEATHER_DROPS: readonly { x: number; delay: number; dur: number; size: number }[] = Array.from({ length: 30 }, (_, i) => {
  const a = Math.sin((i + 3) * 91.7) * 9999.1;
  const b = Math.sin((i + 7) * 37.3) * 7777.7;
  const fa = a - Math.floor(a);
  const fb = b - Math.floor(b);
  return { x: Math.round(fa * 1000) / 10, delay: Math.round(fb * 40) / 10, dur: 0.8 + (i % 5) * 0.18, size: 0.7 + (i % 4) * 0.2 };
});
