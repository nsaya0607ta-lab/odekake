/**
 * ホームの着せかえ（ショップの中で設定する）
 * =============================================================
 * - カードの並び順と、出す・出さない（お知らせ・あなたの実績・図鑑）。犬のカードはいつも一番上
 * - カードの透け感（紙の絵だけを薄くして、うしろの背景を透かす。文字やアイコンはそのまま）
 * 背景と同じく、この端末のCookieに入れる（ホームを描くときにサーバーが読むので、ちらつかない）。
 */

export const HOME_LOOK_COOKIE = "odekake_home_look";

export const HOME_CARD_IDS = ["notice", "highlights", "collection"] as const;
export type HomeCardId = (typeof HOME_CARD_IDS)[number];

export const HOME_CARD_LABELS: Record<HomeCardId, string> = {
  notice: "お知らせ",
  highlights: "あなたの実績",
  collection: "図鑑",
};

export const CARD_STYLES = ["solid", "soft", "clear"] as const;
export type CardStyle = (typeof CARD_STYLES)[number];

export const CARD_STYLE_LABELS: Record<CardStyle, { label: string; note: string }> = {
  solid: { label: "いつもの", note: "紙のカードのまま" },
  soft: { label: "ほんのり", note: "紙が少し透ける" },
  clear: { label: "すけすけ", note: "背景がよく見える" },
};

export type HomeLook = { order: HomeCardId[]; hidden: HomeCardId[]; cards: CardStyle };

export const DEFAULT_HOME_LOOK: HomeLook = { order: [...HOME_CARD_IDS], hidden: [], cards: "solid" };

const isCardId = (v: unknown): v is HomeCardId => typeof v === "string" && (HOME_CARD_IDS as readonly string[]).includes(v);
const isCardStyle = (v: unknown): v is CardStyle => typeof v === "string" && (CARD_STYLES as readonly string[]).includes(v);

/** 受けとった値をととのえる（知らないカードは捨て、足りないカードは後ろに足す） */
export function normalizeHomeLook(value: unknown): HomeLook {
  if (!value || typeof value !== "object") return DEFAULT_HOME_LOOK;
  const v = value as Record<string, unknown>;
  const order = Array.isArray(v.order) ? v.order.filter(isCardId) : [];
  const unique = [...new Set(order)];
  for (const id of HOME_CARD_IDS) if (!unique.includes(id)) unique.push(id);
  const hidden = Array.isArray(v.hidden) ? [...new Set(v.hidden.filter(isCardId))] : [];
  return { order: unique, hidden, cards: isCardStyle(v.cards) ? v.cards : "solid" };
}

/** Cookie の文字列（`notice.highlights.collection|collection|soft`）→ 設定 */
export function parseHomeLook(raw: string | undefined): HomeLook {
  if (!raw) return DEFAULT_HOME_LOOK;
  const [order = "", hidden = "", cards = ""] = raw.split("|");
  return normalizeHomeLook({ order: order.split("."), hidden: hidden ? hidden.split(".") : [], cards });
}

export function serializeHomeLook(look: HomeLook): string {
  return `${look.order.join(".")}|${look.hidden.join(".")}|${look.cards}`;
}
