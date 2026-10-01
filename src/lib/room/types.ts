/**
 * わんこのおへや
 * =============================================================
 * 図鑑アイテム・おでかけの写真・おさんぽフレンチーのトロフィー・行った都道府県のペナントを飾り、
 * 壁紙・床・カーテン・ラグを選べる部屋。犬（選んでいるすがた）が部屋の中で暮らしている。
 *
 * 座標は部屋の幅・高さに対する %（x: 0〜100, y: 0〜100）。
 * - 壁に掛けるもの（写真・ペナント）は中心の位置
 * - 置くもの（アイテム・トロフィー）は足もとの位置。棚の上か床のどちらかに乗る
 * 置き方（RoomLayout）は user_rooms に保存し、置けるかどうかは表示のたびに持ち物から確かめる。
 */
import type { CollectionCategory } from "@/lib/collection/items";
import type { GachaRarity } from "@/lib/gacha/config";

export type DecorKind = "item" | "photo" | "trophy" | "pennant";

type DecorBase = { key: string; name: string; count: number };
export type DecorEntry =
  | (DecorBase & { kind: "item"; image: string; category: CollectionCategory; series: string | null; rarity: GachaRarity })
  | (DecorBase & { kind: "photo"; image: string; full: string; date: string; comment: string; pref: string })
  | (DecorBase & { kind: "trophy"; stage: string; rank: string; color: string; score: number })
  | (DecorBase & { kind: "pennant"; emoji: string; color: string });

export const FRAME_STYLES = ["wood", "white", "polaroid", "gold"] as const;
export type FrameStyle = (typeof FRAME_STYLES)[number];

export type Placement = {
  id: string;
  key: string;
  x: number;
  y: number;
  /** 大きさ（1が基準） */
  scale: number;
  flip: boolean;
  /** 同じ面（壁・棚・床）の中での重なり順 */
  z: number;
  /** 写真の額縁 */
  frame?: FrameStyle;
};

export const WALLPAPERS = ["cream", "mint-stripe", "pink-gingham", "blue-dots", "flower", "night-stars", "wood-panel"] as const;
export const FLOORS = ["wood-light", "wood-dark", "tatami", "checker", "carpet"] as const;
export const CURTAINS = ["leaf", "sakura", "sky", "lemon", "berry"] as const;
export const RUGS = ["none", "round-cream", "oval-pink", "rect-green", "round-navy"] as const;
export type Wallpaper = (typeof WALLPAPERS)[number];
export type Floor = (typeof FLOORS)[number];
export type Curtain = (typeof CURTAINS)[number];
export type Rug = (typeof RUGS)[number];
export type RoomTheme = { wall: Wallpaper; floor: Floor; curtain: Curtain; rug: Rug };

export type RoomLayout = { theme: RoomTheme; items: Placement[] };

export const DEFAULT_THEME: RoomTheme = { wall: "cream", floor: "wood-light", curtain: "leaf", rug: "round-cream" };
export const ROOM_MAX_ITEMS = 120;

/** 部屋の形（% 単位）。壁と床の境目・棚・窓 */
export const ROOM = {
  /** 部屋の縦横比（高さ / 幅） */
  aspect: 1.12,
  /** 壁の下端（ここから下が床） */
  horizon: 56,
  /** 床に置けるいちばん奥と手前 */
  floorTop: 60,
  floorBottom: 96,
  /** 壁に掛けられる範囲 */
  wallTop: 6,
  wallBottom: 50,
  /** 棚（右の壁に2段）。y は棚板の上面 */
  shelves: [
    { y: 27, x0: 58, x1: 93 },
    { y: 42, x0: 58, x1: 93 },
  ],
  window: { x0: 7, x1: 37, y0: 9, y1: 38 },
} as const;

export const isHanging = (kind: DecorKind) => kind === "photo" || kind === "pennant";

export const photoKey = (photoId: string) => `photo:${photoId}`;
export const trophyKey = (stage: string) => `trophy:${stage}`;
export const pennantKey = (prefCode: string) => `pennant:${prefCode}`;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const oneOf = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : fallback;

/** 保存された部屋を読む。おかしな値は直し、置けなくなったもの（validKeys に無いもの）は外す */
export function parseRoomLayout(value: unknown, validKeys?: ReadonlySet<string>): RoomLayout {
  const root = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const t = root.theme && typeof root.theme === "object" ? (root.theme as Record<string, unknown>) : {};
  const theme: RoomTheme = {
    wall: oneOf(WALLPAPERS, t.wall, DEFAULT_THEME.wall),
    floor: oneOf(FLOORS, t.floor, DEFAULT_THEME.floor),
    curtain: oneOf(CURTAINS, t.curtain, DEFAULT_THEME.curtain),
    rug: oneOf(RUGS, t.rug, DEFAULT_THEME.rug),
  };
  const rawItems = Array.isArray(root.items) ? root.items.slice(0, ROOM_MAX_ITEMS) : [];
  const items = rawItems.flatMap((raw): Placement[] => {
    if (!raw || typeof raw !== "object") return [];
    const p = raw as Record<string, unknown>;
    if (typeof p.id !== "string" || typeof p.key !== "string" || p.id.length > 64 || p.key.length > 120) return [];
    if (validKeys && !validKeys.has(p.key)) return [];
    const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
    return [{
      id: p.id,
      key: p.key,
      x: clamp(num(p.x, 50), 3, 97),
      y: clamp(num(p.y, 70), ROOM.wallTop, ROOM.floorBottom),
      scale: clamp(num(p.scale, 1), 0.5, 2),
      flip: p.flip === true,
      z: Math.round(clamp(num(p.z, 1), 0, 100000)),
      ...(typeof p.frame === "string" ? { frame: oneOf(FRAME_STYLES, p.frame, "wood") } : {}),
    }];
  });
  return { theme, items };
}

/** 置くもの（アイテム・トロフィー）が乗っている棚（無ければ床） */
export function shelfOf(p: { x: number; y: number }): (typeof ROOM.shelves)[number] | null {
  return ROOM.shelves.find((s) => Math.abs(p.y - s.y) < 0.01 && p.x >= s.x0 && p.x <= s.x1) ?? null;
}

/** 床の奥ほど小さく見せる倍率 */
export function depthScale(y: number): number {
  return 0.7 + (0.48 * (clamp(y, ROOM.floorTop, ROOM.floorBottom) - ROOM.floorTop)) / (ROOM.floorBottom - ROOM.floorTop);
}

/**
 * 動かした先に合わせて位置を整える。
 * 掛けるものは壁の範囲に、置くものは棚の近くなら棚の上に、それ以外は床に乗せる
 */
export function settle(kind: DecorKind, x: number, y: number): { x: number; y: number } {
  if (isHanging(kind)) return { x: clamp(x, 6, 94), y: clamp(y, ROOM.wallTop + 4, ROOM.wallBottom) };
  const nx = clamp(x, 4, 96);
  const shelf = ROOM.shelves.find((s) => nx >= s.x0 + 2 && nx <= s.x1 - 2 && y > s.y - 7 && y < s.y + 5);
  if (shelf) return { x: nx, y: shelf.y };
  return { x: nx, y: clamp(y, ROOM.floorTop, ROOM.floorBottom) };
}
