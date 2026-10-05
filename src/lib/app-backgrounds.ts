/**
 * アプリの背景（ショップで青コインで買って、アプリ全体の背景にする）
 * =============================================================
 * - 見た目は src/app/app-backgrounds.css の `.app-bg[data-bg="..."]` に書いてある
 * - 値段は DB の app_background_price（0122_app_backgrounds_shop.sql）と同じにする
 * - 選んでいる背景はCookieを正として読む（犬スキンと同じ。画面遷移のたびにDBへ問い合わせないため）
 */

export const APP_BACKGROUND_IDS = [
  "default",
  "paw",
  "washi",
  "watercolor",
  "autumn",
  "map",
  "scenery",
  "starry",
  "aurora",
  "sky-clock",
] as const;
export type AppBackgroundId = (typeof APP_BACKGROUND_IDS)[number];

export const APP_BACKGROUND_COOKIE = "odekake_app_bg";

export type AppBackground = {
  id: AppBackgroundId;
  name: string;
  /** ショップの一覧で名前の横に出す短い説明 */
  sub: string;
  description: string;
  /** 青コインの値段。0 は無料（最初から持っている） */
  price: number;
  /** 動き・時間帯などのしるし */
  tag?: string;
  /** 暗い背景。ホーム以外では、文字が読めるように明るい色を重ねて薄める */
  dark?: boolean;
};

const DEFAULT_BACKGROUND: AppBackground = { id: "default", name: "いつもの", sub: "生成りとドット", description: "最初からの背景です。生成り色の紙に、うすいドットが入っています。", price: 0 };

export const APP_BACKGROUNDS: readonly AppBackground[] = [
  DEFAULT_BACKGROUND,
  { id: "paw", name: "肉球スタンプ", sub: "4色の肉球柄", description: "ベージュ・ピンク・ミント・水色の肉球を、角度を変えて散らしています。", price: 1500 },
  { id: "washi", name: "和紙", sub: "繊維とざらつき", description: "和紙の繊維のような白いムラと細かい粒子に、画面のふちだけほんのり影を落としています。", price: 1500 },
  { id: "watercolor", name: "水彩にじみ", sub: "5色がにじむ", description: "水色・ピンク・若葉・黄色・薄紫を、水彩絵の具がにじんだように四隅に置いています。", price: 1500 },
  { id: "autumn", name: "秋の落ち葉", sub: "イチョウと紅葉", description: "暖かい色のグラデーションに、イチョウと紅葉の葉を散らしています。", price: 1500 },
  { id: "map", name: "おでかけ地図", sub: "等高線と道とピン", description: "地図の等高線と方眼に、点線の道と2本のピンを描いています。", price: 2500 },
  { id: "scenery", name: "空と丘", sub: "雲と3段の丘", description: "空に雲を浮かべ、画面の下に丘を重ねています。丘は下のナビの奥に透けて見えます。", price: 2500 },
  { id: "starry", name: "星空", sub: "星と光の帯", description: "夜空に大小の星を散らし、天の川のような淡い光の帯を入れています。ホーム以外の画面では、文字が読みやすいように薄めて表示します。", price: 2500, dark: true },
  { id: "aurora", name: "パステルオーロラ", sub: "ゆっくり動く", description: "5色のふんわりしたグラデーションが、40秒かけてゆっくり回ります。", price: 4000, tag: "動く" },
  { id: "sky-clock", name: "時間で変わる空", sub: "朝・昼・夕方・夜", description: "開いている時刻（日本時間）に合わせて、朝・昼・夕方・夜の空に自動で切り替わります。夜は星が出ます。", price: 4000, tag: "時間帯" },
];

const BY_ID = new Map(APP_BACKGROUNDS.map((bg) => [bg.id, bg]));

export function isAppBackgroundId(value: unknown): value is AppBackgroundId {
  return typeof value === "string" && (APP_BACKGROUND_IDS as readonly string[]).includes(value);
}

export function getAppBackground(id: AppBackgroundId): AppBackground {
  return BY_ID.get(id) ?? DEFAULT_BACKGROUND;
}

export type SkyTime = "morning" | "day" | "evening" | "night";

/** 「時間で変わる空」の時間帯（日本時間）。朝5〜10時／昼10〜16時／夕方16〜19時／夜19〜5時 */
export function skyTimeOf(date: Date): SkyTime {
  const hour = (date.getUTCHours() + 9) % 24;
  if (hour >= 5 && hour < 10) return "morning";
  if (hour >= 10 && hour < 16) return "day";
  if (hour >= 16 && hour < 19) return "evening";
  return "night";
}

/** ホーム以外で薄めて表示するか（暗い背景のときだけ） */
export function isDarkBackground(id: AppBackgroundId, skyTime: SkyTime): boolean {
  if (id === "sky-clock") return skyTime === "night";
  return Boolean(getAppBackground(id).dark);
}
