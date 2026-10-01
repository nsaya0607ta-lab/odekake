/** わんこのおへやの、選べる壁紙・床・カーテン・ラグの名前と色 */
import type { Curtain, Floor, RoomKind, Rug, Wallpaper } from "./types";

export const WALLPAPER_STYLES: Record<Wallpaper, { label: string; base: string; ink: string }> = {
  cream: { label: "クリーム", base: "#FBF3E4", ink: "#EFE2C9" },
  "mint-stripe": { label: "ミントのしま", base: "#EAF6EF", ink: "#CFEBDD" },
  "pink-gingham": { label: "ピンクのチェック", base: "#FDF0F2", ink: "#F6D3DA" },
  "blue-dots": { label: "水玉", base: "#EEF4FB", ink: "#C9DCF2" },
  flower: { label: "小花", base: "#FFF8EC", ink: "#F2B8A8" },
  "night-stars": { label: "星空", base: "#2E3566", ink: "#F6E7A8" },
  "wood-panel": { label: "木の壁", base: "#E9CFA6", ink: "#D6B588" },
  log: { label: "丸太", base: "#C8935C", ink: "#9A6838" },
  brick: { label: "レンガ", base: "#E9DCCB", ink: "#B8604A" },
  shiplap: { label: "白い板ばり", base: "#F3F7FA", ink: "#C9D8E4" },
  plaster: { label: "しっくい", base: "#EFE6D2", ink: "#DCCFB2" },
  "fog-blue": { label: "グレーブルー", base: "#DDE6EC", ink: "#C9D5DD" },
};

export const FLOOR_STYLES: Record<Floor, { label: string; base: string; line: string }> = {
  "wood-light": { label: "明るい木", base: "#E8C99A", line: "#D4AE78" },
  "wood-dark": { label: "こげ茶の木", base: "#9C6B45", line: "#7E5233" },
  tatami: { label: "たたみ", base: "#D7D59A", line: "#B9B774" },
  checker: { label: "タイル", base: "#F4EFE6", line: "#D9CDB8" },
  carpet: { label: "じゅうたん", base: "#C7B4D9", line: "#B49FC9" },
  herringbone: { label: "ヘリンボーン", base: "#B9875A", line: "#8E6038" },
  "white-wood": { label: "白い木", base: "#F1E6D6", line: "#DCCDB6" },
};

/** 部屋の雰囲気の名前と、天井・幅木の色、部屋全体にうすくかける色 */
export const ROOM_KIND_STYLES: Record<RoomKind, { label: string; ceiling: string; baseboard: string; tint: string | null; tintOpacity: number }> = {
  cozy: { label: "いつもの", ceiling: "#F1E9DA", baseboard: "#FBF6EC", tint: null, tintOpacity: 0 },
  log: { label: "ログハウス", ceiling: "#B07A45", baseboard: "#7A4E2A", tint: "#FFB060", tintOpacity: 0.06 },
  wa: { label: "和モダン", ceiling: "#D9B98E", baseboard: "#5A3A1C", tint: "#E8D4A0", tintOpacity: 0.04 },
  nordic: { label: "北欧", ceiling: "#FFFFFF", baseboard: "#FFFFFF", tint: "#DDEBFF", tintOpacity: 0.05 },
  cafe: { label: "カフェ", ceiling: "#3A3632", baseboard: "#3A3632", tint: "#FF9A40", tintOpacity: 0.06 },
  seaside: { label: "海辺の家", ceiling: "#FFFFFF", baseboard: "#4A7FB0", tint: "#9ED8FF", tintOpacity: 0.05 },
  starry: { label: "星空のへや", ceiling: "#1E2450", baseboard: "#2E3566", tint: "#6A5ACD", tintOpacity: 0.07 },
};

export const CURTAIN_STYLES: Record<Curtain, { label: string; color: string }> = {
  leaf: { label: "わかば", color: "#8CBF7A" },
  sakura: { label: "さくら", color: "#F2A7B8" },
  sky: { label: "そら", color: "#8DBDE6" },
  lemon: { label: "レモン", color: "#F2D16B" },
  berry: { label: "ベリー", color: "#B65A7A" },
};

export const RUG_STYLES: Record<Rug, { label: string; color: string; shape: "none" | "round" | "oval" | "rect" }> = {
  none: { label: "なし", color: "transparent", shape: "none" },
  "round-cream": { label: "まるいクリーム", color: "#FFF6E4", shape: "round" },
  "oval-pink": { label: "ピンクのだ円", color: "#F7C9D2", shape: "oval" },
  "rect-green": { label: "みどりの四角", color: "#BFDDB0", shape: "rect" },
  "round-navy": { label: "ネイビー", color: "#4A5A8C", shape: "round" },
};

/** 都道府県のペナントに描く名物（絵文字）と色 */
export const PENNANTS: Readonly<Record<string, { emoji: string; color: string }>> = {
  "01": { emoji: "🦀", color: "#3E7CC8" }, "02": { emoji: "🍎", color: "#D2453B" }, "03": { emoji: "🥢", color: "#8A5A34" },
  "04": { emoji: "🥩", color: "#B4473A" }, "05": { emoji: "🐕", color: "#C9853A" }, "06": { emoji: "🍒", color: "#C8364F" },
  "07": { emoji: "🐂", color: "#C8402F" }, "08": { emoji: "🫘", color: "#9A7A3A" }, "09": { emoji: "🍓", color: "#D8405A" },
  "10": { emoji: "♨️", color: "#C25A3A" }, "11": { emoji: "🍠", color: "#8A4A86" }, "12": { emoji: "🥜", color: "#B88A3E" },
  "13": { emoji: "🗼", color: "#D2453B" }, "14": { emoji: "🥟", color: "#2F7FA8" }, "15": { emoji: "🍙", color: "#5A8A3A" },
  "16": { emoji: "🦑", color: "#2F6FB0" }, "17": { emoji: "✨", color: "#C9A23A" }, "18": { emoji: "🦖", color: "#3E8A5A" },
  "19": { emoji: "🍇", color: "#7A4A9A" }, "20": { emoji: "🏔️", color: "#3E7A9A" }, "21": { emoji: "🏯", color: "#5A6A8A" },
  "22": { emoji: "🍵", color: "#3E8A4A" }, "23": { emoji: "🍤", color: "#D2843A" }, "24": { emoji: "🦞", color: "#C2453A" },
  "25": { emoji: "🌊", color: "#2F8AB0" }, "26": { emoji: "⛩️", color: "#B8323A" }, "27": { emoji: "🐙", color: "#D2563B" },
  "28": { emoji: "🐄", color: "#6A4A3A" }, "29": { emoji: "🦌", color: "#8A6A3A" }, "30": { emoji: "🐼", color: "#3E8A5A" },
  "31": { emoji: "🐫", color: "#C9A25A" }, "32": { emoji: "💕", color: "#C8506E" }, "33": { emoji: "🍑", color: "#E07A8A" },
  "34": { emoji: "🦪", color: "#3E6A9A" }, "35": { emoji: "🐡", color: "#2F7FA8" }, "36": { emoji: "💃", color: "#C2457A" },
  "37": { emoji: "🍜", color: "#C9A23A" }, "38": { emoji: "🍊", color: "#E0842F" }, "39": { emoji: "🐟", color: "#2F6FB0" },
  "40": { emoji: "🌶️", color: "#C8362F" }, "41": { emoji: "🏺", color: "#3E5A9A" }, "42": { emoji: "🍰", color: "#C9853A" },
  "43": { emoji: "🐻", color: "#3A3A3A" }, "44": { emoji: "🐵", color: "#B8703A" }, "45": { emoji: "🥭", color: "#E0942F" },
  "46": { emoji: "🌋", color: "#8A3A3A" }, "47": { emoji: "🌺", color: "#D8406E" },
};
