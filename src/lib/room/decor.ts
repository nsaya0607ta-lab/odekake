/**
 * おへや（飾り部屋）に置けるもの
 * =============================================================
 * - item:     図鑑アイテム（キーは図鑑のID。持っている数だけ置ける）
 * - photo:    おでかけの写真（額縁に入れて飾る。キーは "photo:{visit_photos.id}"）
 * - trophy:   おさんぽフレンチーの道ごとのベスト記録（キーは "trophy:{stage}"）
 * - souvenir: おでかけを記録した都道府県のおみやげペナント（キーは "souvenir:{都道府県コード}"）
 * 置き方（Placement）は user_decoration_rooms に保存し、置けるかどうかは毎回ここから確かめる。
 */
import type { CollectionCategory } from "@/lib/collection/items";
import type { GachaRarity } from "@/lib/gacha/config";

export type DecorKind = "item" | "photo" | "trophy" | "souvenir";

type DecorBase = { key: string; name: string; count: number };
export type DecorEntry =
  | (DecorBase & { kind: "item"; image: string; category: CollectionCategory; series: string | null; rarity: GachaRarity })
  | (DecorBase & { kind: "photo"; image: string; date: string })
  | (DecorBase & { kind: "trophy"; rank: string; color: string; score: number })
  | (DecorBase & { kind: "souvenir"; emoji: string; color: string });

export type Placement = {
  instanceId: string;
  itemId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipped: boolean;
  z: number;
};

export const ROOM_MAX_PLACEMENTS = 120;

export const photoDecorKey = (photoId: string) => `photo:${photoId}`;
export const trophyDecorKey = (stage: string) => `trophy:${stage}`;
export const souvenirDecorKey = (prefCode: string) => `souvenir:${prefCode}`;

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 保存された置き方を読む。置けなくなったもの（validIds に無いもの）は外す */
export function parsePlacements(value: unknown, validIds?: ReadonlySet<string>): Placement[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, ROOM_MAX_PLACEMENTS).flatMap((entry): Placement[] => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Partial<Placement>;
    if (typeof item.instanceId !== "string" || typeof item.itemId !== "string") return [];
    if (item.instanceId.length > 64 || item.itemId.length > 120) return [];
    if (validIds && !validIds.has(item.itemId)) return [];
    if (typeof item.x !== "number" || typeof item.y !== "number" || !Number.isFinite(item.x) || !Number.isFinite(item.y)) return [];
    return [{
      instanceId: item.instanceId,
      itemId: item.itemId,
      x: clampNumber(item.x, 6, 94),
      y: clampNumber(item.y, 10, 90),
      scale: clampNumber(typeof item.scale === "number" && Number.isFinite(item.scale) ? item.scale : 1, 0.55, 1.8),
      rotation: typeof item.rotation === "number" && Number.isFinite(item.rotation) ? ((Math.round(item.rotation) % 360) + 360) % 360 : 0,
      flipped: item.flipped === true,
      z: typeof item.z === "number" && Number.isFinite(item.z) ? Math.round(clampNumber(item.z, 0, 10000)) : 1,
    }];
  });
}

/** 都道府県のおみやげペナントに描く名物（絵文字）と色 */
export const SOUVENIRS: Readonly<Record<string, { emoji: string; color: string }>> = {
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
