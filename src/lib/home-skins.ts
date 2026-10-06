/**
 * ホームのカードの絵がら（ショップで青コインで買う）
 * =============================================================
 * - カードは4つ（わんこのカード・お知らせ・あなたの実績・図鑑）。絵がら（テーマ）ごとに、1枚ずつ買って1枚ずつ変えられる
 * - 「セット」で、そのテーマの持っていないカードをまとめて買って（2割引）、ぜんぶ一度に変えることもできる
 * - 文字やボタンの位置は変えない。新しい絵は、いまの絵と同じ大きさ・同じ紙の位置にそろえてある
 *   （わんこのカードの看板だけは絵によって少し位置がちがうので、テーマごとに位置を持つ）
 * - 値段は DB の home_skin_price（0132・0133）と同じにする
 */

export const HOME_SKIN_PARTS = ["scene", "notice", "highlights", "collection"] as const;
export type HomeSkinPart = (typeof HOME_SKIN_PARTS)[number];

export const HOME_SKIN_THEMES = ["default", "winter", "deluxe"] as const;
export type HomeSkinTheme = (typeof HOME_SKIN_THEMES)[number];

export type HomeSkins = Record<HomeSkinPart, HomeSkinTheme>;

export const DEFAULT_HOME_SKINS: HomeSkins = { scene: "default", notice: "default", highlights: "default", collection: "default" };

export const HOME_SKIN_PART_LABELS: Record<HomeSkinPart, string> = {
  scene: "わんこのカード",
  notice: "お知らせ",
  highlights: "あなたの実績",
  collection: "図鑑",
};

export type HomeSkinThemeInfo = { name: string; sub: string; description: string; prices: Record<HomeSkinPart, number> };

const FREE: Record<HomeSkinPart, number> = { scene: 0, notice: 0, highlights: 0, collection: 0 };

export const HOME_SKIN_THEME_INFO: Record<HomeSkinTheme, HomeSkinThemeInfo> = {
  default: { name: "いつもの", sub: "野原と花", description: "最初からのカードです。", prices: FREE },
  winter: {
    name: "冬",
    sub: "雪の野原と木のわく",
    description: "雪の野原をわんこが歩き、カードは雪をかぶった木のわくに。雪だるまやまつぼっくりが添えてあります。",
    prices: { scene: 1500, notice: 800, highlights: 800, collection: 800 },
  },
  deluxe: {
    name: "豪華",
    sub: "金のわくと宮殿の庭",
    description: "湖と古城の見える宮殿の庭を、わんこが歩きます。カードは金のわくに、王冠・宝石・真珠をあしらいました。",
    prices: { scene: 2000, notice: 1000, highlights: 1000, collection: 1000 },
  },
};

/** ショップに並べるテーマ（いつもの は、もどすボタンで出す） */
export const SHOP_HOME_SKIN_THEMES = HOME_SKIN_THEMES.filter((t) => t !== "default");

/** セットでまとめて買うときの割引（持っていないカードの合計の 2割引、100枚単位で切り下げ） */
export const HOME_SKIN_SET_DISCOUNT = 0.8;

export function homeSkinPrice(theme: HomeSkinTheme, part: HomeSkinPart): number {
  return HOME_SKIN_THEME_INFO[theme].prices[part];
}

/** 持っていないカードの値段の合計と、セットで買ったときの値段 */
export function homeSkinSetPrice(theme: HomeSkinTheme, owned: ReadonlySet<string>): { full: number; set: number; missing: HomeSkinPart[] } {
  const missing = HOME_SKIN_PARTS.filter((part) => homeSkinPrice(theme, part) > 0 && !owned.has(homeSkinKey(theme, part)));
  const full = missing.reduce((sum, part) => sum + homeSkinPrice(theme, part), 0);
  // 1枚だけなら割引なし（セットは2枚以上をまとめたとき）
  const set = missing.length >= 2 ? Math.floor((full * HOME_SKIN_SET_DISCOUNT) / 100) * 100 : full;
  return { full, set, missing };
}

export const homeSkinKey = (theme: HomeSkinTheme, part: HomeSkinPart) => `${theme}:${part}`;

export const isHomeSkinPart = (v: unknown): v is HomeSkinPart => typeof v === "string" && (HOME_SKIN_PARTS as readonly string[]).includes(v);
export const isHomeSkinTheme = (v: unknown): v is HomeSkinTheme => typeof v === "string" && (HOME_SKIN_THEMES as readonly string[]).includes(v);

/** 受けとった値をととのえる（知らないものは いつもの） */
export function normalizeHomeSkins(value: unknown): HomeSkins {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const out = { ...DEFAULT_HOME_SKINS };
  for (const part of HOME_SKIN_PARTS) if (isHomeSkinTheme(v[part])) out[part] = v[part];
  return out;
}

/** カードの絵（public/ の画像） */
export const HOME_SKIN_ART = {
  notice: { default: "/notice-card.webp", winter: "/home-skins/winter/notice.webp", deluxe: "/home-skins/deluxe/notice.webp" },
  collection: { default: "/collection-card.webp", winter: "/home-skins/winter/collection.webp", deluxe: "/home-skins/deluxe/collection.webp" },
  highlights: { default: "/home-highlights-frame.webp", winter: "/home-skins/winter/highlights.webp", deluxe: "/home-skins/deluxe/highlights.webp" },
  scene: { default: "/characters/home-scene.webp", winter: "/home-skins/winter/scene.webp", deluxe: "/home-skins/deluxe/scene.webp" },
  sceneFrame: { default: "/home-scene-frame.webp", winter: "/home-skins/winter/scene-frame.webp", deluxe: "/home-skins/deluxe/scene-frame.webp" },
} as const satisfies Record<string, Record<HomeSkinTheme, string>>;

/** ショップの見本で小さく見せる絵 */
export function homeSkinPreview(theme: HomeSkinTheme, part: HomeSkinPart): string {
  return HOME_SKIN_ART[part][theme];
}
