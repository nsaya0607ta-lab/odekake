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

export type DecorKind = "item" | "photo" | "trophy" | "pennant" | "furniture" | "fixture";

type DecorBase = { key: string; name: string; count: number };
export type DecorEntry =
  | (DecorBase & { kind: "item"; image: string; category: CollectionCategory; series: string | null; rarity: GachaRarity })
  | (DecorBase & { kind: "photo"; image: string; full: string; date: string; comment: string; pref: string; upload?: boolean })
  | (DecorBase & { kind: "trophy"; stage: string; rank: string; color: string; score: number })
  | (DecorBase & { kind: "pennant"; emoji: string; color: string })
  | (DecorBase & { kind: "furniture"; furniture: FurnitureId })
  | (DecorBase & { kind: "fixture"; fixture: FixtureId });

/** だれでも置ける家具（絵は decor-visual.tsx で描く）。width は床の手前に置いたときの幅（部屋の幅に対する %） */
export const FURNITURE = {
  sofa: { name: "ソファ", width: 36 },
  "dog-bed": { name: "わんこベッド", width: 24 },
  plant: { name: "観葉植物", width: 13 },
  bookshelf: { name: "本だな", width: 19 },
  lamp: { name: "フロアランプ", width: 10 },
  table: { name: "ローテーブル", width: 25 },
  "dog-house": { name: "わんこハウス", width: 27 },
  bowl: { name: "ごはん皿", width: 10 },
} as const;
export type FurnitureId = keyof typeof FURNITURE;
export const FURNITURE_IDS = Object.keys(FURNITURE) as FurnitureId[];
export const furnitureKey = (id: FurnitureId) => `furniture:${id}`;
export const FURNITURE_ENTRIES: DecorEntry[] = FURNITURE_IDS.map((id) => ({ kind: "furniture", key: furnitureKey(id), name: FURNITURE[id].name, furniture: id, count: 2 }));

/**
 * 部屋のつくり（窓・壁の棚・かけ時計・お天気ボード）。ほかの飾りと同じように動かす・大きさを変える・しまうができる。
 * 絵は room-scene.tsx の FixtureVisual で描く
 */
export const FIXTURES = {
  window: { name: "窓", count: 2 },
  shelf: { name: "かべの棚", count: 3 },
  clock: { name: "かけ時計", count: 1 },
  weather: { name: "お天気ボード", count: 1 },
} as const;
export type FixtureId = keyof typeof FIXTURES;
export const FIXTURE_IDS = Object.keys(FIXTURES) as FixtureId[];
export const fixtureKey = (id: FixtureId) => `fixture:${id}`;
export const FIXTURE_ENTRIES: DecorEntry[] = FIXTURE_IDS.map((id) => ({ kind: "fixture", key: fixtureKey(id), name: FIXTURES[id].name, fixture: id, count: FIXTURES[id].count }));
const isFixtureKey = (key: string) => FIXTURE_IDS.some((id) => fixtureKey(id) === key);

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
  /**
   * 棚に乗せたときの棚（置いたものの id）と、棚の左はしからの位置（0〜1）。
   * 棚を動かしたり大きさを変えたりすると、乗せたものもいっしょに動き、同じ割合で大きさが変わる
   */
  on?: string;
  rx?: number;
};

export const WALLPAPERS = ["cream", "mint-stripe", "pink-gingham", "blue-dots", "flower", "night-stars", "wood-panel", "log", "brick", "shiplap", "plaster", "fog-blue"] as const;
export const FLOORS = ["wood-light", "wood-dark", "tatami", "checker", "carpet", "herringbone", "white-wood"] as const;
export const CURTAINS = ["leaf", "sakura", "sky", "lemon", "berry"] as const;
export const RUGS = ["none", "round-cream", "oval-pink", "rect-green", "round-navy"] as const;
export const WALL_DECOS = ["none", "garland", "lights", "stars"] as const;
/**
 * 部屋の雰囲気（天井・はり・柱・腰壁・照明・色味など、部屋のつくりそのもの）。
 * 選ぶと、合う壁紙・床・窓などもまとめて切りかわる（そのあと個別に変えてもよい）
 */
export const ROOM_KINDS = ["cozy", "log", "wa", "nordic", "cafe", "seaside", "starry"] as const;
/** 窓の形。どれも窓は必ず1つある */
export const ROOM_STYLES = ["standard", "arch", "bay", "round", "attic", "shoji", "french"] as const;
export type Wallpaper = (typeof WALLPAPERS)[number];
export type Floor = (typeof FLOORS)[number];
export type Curtain = (typeof CURTAINS)[number];
export type Rug = (typeof RUGS)[number];
export type WallDeco = (typeof WALL_DECOS)[number];
export type RoomStyle = (typeof ROOM_STYLES)[number];
export type RoomKind = (typeof ROOM_KINDS)[number];
export type RoomTheme = {
  wall: Wallpaper; floor: Floor; curtain: Curtain; rug: Rug; deco: WallDeco; style: RoomStyle; room: RoomKind;
  /** 季節の行事かざり（お正月・ハロウィン・クリスマスなど）を自動で出すか。ないときは出す */
  events?: boolean;
};

/** 端末から選んで、おへや用にアップロードした写真（Storage の users/{自分}/room/ に置く） */
export type RoomPhoto = { id: string; path: string; date: string; title: string };

/** v: 2 から窓・棚・時計も items に入る（それより前の部屋は読みこむときに足す） */
export type RoomLayout = { theme: RoomTheme; items: Placement[]; photos: RoomPhoto[]; v?: number };

export const DEFAULT_THEME: RoomTheme = { wall: "cream", floor: "wood-light", curtain: "leaf", rug: "round-cream", deco: "garland", style: "standard", room: "cozy" };
/** 部屋の雰囲気を選んだときに、いっしょに切りかえる壁紙・床・窓など */
export const ROOM_PRESETS: Record<RoomKind, RoomTheme> = {
  cozy: DEFAULT_THEME,
  log: { room: "log", wall: "log", floor: "wood-dark", curtain: "berry", rug: "rect-green", deco: "none", style: "standard" },
  wa: { room: "wa", wall: "plaster", floor: "tatami", curtain: "leaf", rug: "none", deco: "none", style: "shoji" },
  nordic: { room: "nordic", wall: "fog-blue", floor: "white-wood", curtain: "sky", rug: "round-cream", deco: "garland", style: "french" },
  cafe: { room: "cafe", wall: "brick", floor: "herringbone", curtain: "lemon", rug: "rect-green", deco: "lights", style: "arch" },
  seaside: { room: "seaside", wall: "shiplap", floor: "wood-light", curtain: "sky", rug: "round-navy", deco: "none", style: "round" },
  starry: { room: "starry", wall: "night-stars", floor: "carpet", curtain: "berry", rug: "round-navy", deco: "stars", style: "attic" },
};
export const ROOM_MAX_ITEMS = 120;
/** アップロードして飾れる写真の数 */
export const ROOM_MAX_PHOTOS = 40;
export const ROOM_PHOTO_TITLE_MAX = 20;
const ROOM_PHOTO_PATH = /^users\/[0-9a-f-]{36}\/room\/[0-9a-f-]{36}\.jpg$/;

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
  /** いつもの部屋の窓（ほかの形は windowOf で） */
  window: { x0: 7, x1: 37, y0: 9, y1: 38 },
} as const;

export const isHanging = (kind: DecorKind) => kind === "photo" || kind === "pennant" || kind === "fixture";

export const photoKey = (photoId: string) => `photo:${photoId}`;
export const trophyKey = (stage: string) => `trophy:${stage}`;
export const pennantKey = (prefCode: string) => `pennant:${prefCode}`;
export const uploadKey = (photoId: string) => `upload:${photoId}`;

/** アップロードした写真の配信URL（/api/photo が権限を確かめて返す） */
export function roomPhotoUrl(path: string, thumb: boolean): string {
  const encoded = path.split("/").map((seg) => encodeURIComponent(seg)).join("/");
  return `/api/photo/${encoded}${thumb ? "?thumb=1" : ""}`;
}

/** アップロードした写真を、飾れるものの形にする */
export function uploadEntry(photo: RoomPhoto): DecorEntry {
  return {
    kind: "photo", key: uploadKey(photo.id), name: photo.title || "じぶんの写真", image: roomPhotoUrl(photo.path, true),
    full: roomPhotoUrl(photo.path, false), date: photo.date, comment: "", pref: "", count: 1, upload: true,
  };
}

/** アップロードした写真のパスとして正しいか（ownerId を渡すと、その人のものだけ） */
export function isRoomPhotoPath(path: string, ownerId?: string): boolean {
  return ROOM_PHOTO_PATH.test(path) && (!ownerId || path.startsWith(`users/${ownerId}/room/`));
}

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
    deco: oneOf(WALL_DECOS, t.deco, "none"),
    style: oneOf(ROOM_STYLES, t.style, "standard"),
    room: oneOf(ROOM_KINDS, t.room, "cozy"),
    ...(t.events === false ? { events: false } : {}),
  };
  const rawPhotos = Array.isArray(root.photos) ? root.photos.slice(0, ROOM_MAX_PHOTOS) : [];
  const photos = rawPhotos.flatMap((raw): RoomPhoto[] => {
    if (!raw || typeof raw !== "object") return [];
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string" || !/^[0-9a-f-]{36}$/.test(r.id) || typeof r.path !== "string" || !isRoomPhotoPath(r.path)) return [];
    return [{
      id: r.id,
      path: r.path,
      date: typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : "",
      title: typeof r.title === "string" ? r.title.trim().slice(0, ROOM_PHOTO_TITLE_MAX) : "",
    }];
  });
  const uploadKeys = new Set(photos.map((ph) => uploadKey(ph.id)));
  const rawItems = Array.isArray(root.items) ? root.items.slice(0, ROOM_MAX_ITEMS) : [];
  const items = rawItems.flatMap((raw): Placement[] => {
    if (!raw || typeof raw !== "object") return [];
    const p = raw as Record<string, unknown>;
    if (typeof p.id !== "string" || typeof p.key !== "string" || p.id.length > 64 || p.key.length > 120) return [];
    if (p.key.startsWith("upload:") ? !uploadKeys.has(p.key) : !isFixtureKey(p.key) && validKeys && !validKeys.has(p.key)) return [];
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
      ...(typeof p.on === "string" && p.on.length <= 64 ? { on: p.on, rx: clamp(num(p.rx, 0.5), 0, 1) } : {}),
    }];
  });
  if (root.v === 2) {
    // 棚がなくなった（しまった）ものは床に下ろす
    const shelfIds = new Set(items.filter((p) => p.key === fixtureKey("shelf")).map((p) => p.id));
    return { theme, items: items.map((p) => (p.on && !shelfIds.has(p.on) ? dropOff(p) : p)), photos, v: 2 };
  }
  return migrateFixtures({ theme, items, photos });
}

/** 棚から下ろす（床の手前に置く） */
function dropOff(p: Placement): Placement {
  const { on: _on, rx: _rx, ...rest } = p;
  return { ...rest, y: clamp(Math.max(p.y, ROOM.floorTop + 8), ROOM.floorTop, ROOM.floorBottom) };
}

/** はじめの窓・棚・時計・お天気ボード（いままで部屋に描きこんでいた場所） */
export function defaultFixtures(style: RoomStyle): Placement[] {
  const win = windowOf(style);
  const put = (id: string, f: FixtureId, x: number, y: number, z: number): Placement => ({ id, key: fixtureKey(f), x, y, scale: 1, flip: false, z });
  return [
    put("fx-window-1", "window", (win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2, 0),
    put("fx-shelf-1", "shelf", (ROOM.shelves[0].x0 + ROOM.shelves[0].x1) / 2, ROOM.shelves[0].y, 0),
    put("fx-shelf-2", "shelf", (ROOM.shelves[1].x0 + ROOM.shelves[1].x1) / 2, ROOM.shelves[1].y, 0),
    put("fx-clock", "clock", 75.5, 12, 0),
    put("fx-weather", "weather", 88.2, 8.8, 0),
  ];
}

/** 窓・棚が部屋に描きこまれていたころの部屋を、動かせる窓・棚つきの部屋に直す（棚の上のものは、その棚に乗せる） */
export function migrateFixtures(layout: RoomLayout): RoomLayout {
  const fixtures = defaultFixtures(layout.theme.style);
  const items = layout.items.map((p): Placement => {
    const i = ROOM.shelves.findIndex((s) => Math.abs(p.y - s.y) < 0.01 && p.x >= s.x0 && p.x <= s.x1);
    if (i < 0) return p;
    const s = ROOM.shelves[i]!;
    return { ...p, on: `fx-shelf-${i + 1}`, rx: clamp((p.x - s.x0) / (s.x1 - s.x0), 0, 1) };
  });
  return { ...layout, items: [...fixtures, ...items], v: 2 };
}

/** 壁の棚の板の幅（大きさ1のとき。部屋の幅に対する %）。棚の (x, y) は板の上の面のまん中 */
export const SHELF_BOARD = 35;
export function shelfBoard(s: Placement): { x0: number; x1: number; y: number } {
  const w = SHELF_BOARD * s.scale;
  return { x0: s.x - w / 2, x1: s.x + w / 2, y: s.y };
}

/** 棚に乗せたものの、いまの位置と、棚の大きさ（乗せたものもこの割合で大きさが変わる） */
export type Placed = Placement & { k: number };
export function resolvePlacements(items: readonly Placement[]): Placed[] {
  const shelves = new Map(items.filter((p) => p.key === fixtureKey("shelf")).map((p) => [p.id, p]));
  return items.map((p) => {
    const s = p.on ? shelves.get(p.on) : undefined;
    if (!s) return { ...p, k: 1 };
    const b = shelfBoard(s);
    return { ...p, x: b.x0 + (p.rx ?? 0.5) * (b.x1 - b.x0), y: b.y, k: s.scale };
  });
}

/** 床の奥ほど小さく見せる倍率 */
export function depthScale(y: number): number {
  return 0.7 + (0.48 * (clamp(y, ROOM.floorTop, ROOM.floorBottom) - ROOM.floorTop)) / (ROOM.floorBottom - ROOM.floorTop);
}

/**
 * 動かした先に合わせて位置を整える。
 * 掛けるもの（写真・ペナント・窓や棚）は壁の範囲に、置くものは棚の近くなら棚の上に、それ以外は床に乗せる。
 * 棚に乗ったら on（棚）と rx（棚の上の位置）を返し、床なら on を消す
 */
export function settle(kind: DecorKind, x: number, y: number, shelves: readonly Placement[] = []): { x: number; y: number; on?: string; rx?: number } {
  if (isHanging(kind)) return { x: clamp(x, 6, 94), y: clamp(y, ROOM.wallTop + 2, ROOM.wallBottom), on: undefined, rx: undefined };
  const nx = clamp(x, 4, 96);
  // 家具は棚に乗らない
  if (kind !== "furniture") {
    for (const s of shelves) {
      const b = shelfBoard(s);
      // 棚の板の少し上〜少し下に落とせば乗る（指でも合わせやすいよう広めに）
      if (nx >= b.x0 - 1 && nx <= b.x1 + 1 && y > b.y - 15 * s.scale && y < b.y + 11 * s.scale) {
        return { x: clamp(nx, b.x0, b.x1), y: b.y, on: s.id, rx: clamp((nx - b.x0) / (b.x1 - b.x0), 0.04, 0.96) };
      }
    }
  }
  return { x: nx, y: clamp(y, ROOM.floorTop, ROOM.floorBottom), on: undefined, rx: undefined };
}

/**
 * 部屋の形ごとの窓（外が見える範囲の外わく。部屋の %）。棚と時計のある右がわにはかからないようにしている。
 * 大きな窓（掃き出し窓）は幅木の上まで、和室の障子は左半分だけ開いている
 */
const ROOM_WINDOWS: Record<RoomStyle, { x0: number; x1: number; y0: number; y1: number }> = {
  standard: ROOM.window,
  arch: { x0: 10, x1: 34, y0: 7, y1: 41 },
  bay: { x0: 8, x1: 40, y0: 12, y1: 37 },
  round: { x0: 11, x1: 33, y0: 13.2, y1: 32.8 },
  attic: { x0: 12, x1: 32, y0: 14, y1: 40 },
  shoji: { x0: 6, x1: 37, y0: 10, y1: 39 },
  french: { x0: 8, x1: 31, y0: 8, y1: ROOM.horizon - 2.1 },
};
export const windowOf = (style: RoomStyle | undefined) => ROOM_WINDOWS[style ?? "standard"];

/** 棚の上で、乗せているものからいちばん離れた位置（0〜1） */
export function freeShelfSpot(shelfId: string, items: readonly Placement[]): number {
  const taken = items.filter((p) => p.on === shelfId).map((p) => p.rx ?? 0.5);
  let best = 0.5, bestD = -1;
  for (let r = 0.12; r <= 0.881; r += 0.04) {
    const d = taken.length ? Math.min(...taken.map((t) => Math.abs(t - r))) : 1 - Math.abs(r - 0.5);
    if (d > bestD + 1e-6) { bestD = d; best = r; }
  }
  return best;
}

/* ---------- 季節の行事かざり ---------- */
export type RoomEvent = "newyear" | "valentine" | "hina" | "hanami" | "kodomo" | "tanabata" | "tsukimi" | "halloween" | "christmas";
/** 行事と、かざる期間（日本時間の月日。両はしをふくむ） */
export const ROOM_EVENTS: readonly { id: RoomEvent; name: string; from: [number, number]; to: [number, number] }[] = [
  { id: "newyear", name: "お正月", from: [1, 1], to: [1, 7] },
  { id: "valentine", name: "バレンタイン", from: [2, 7], to: [2, 14] },
  { id: "hina", name: "ひなまつり", from: [2, 24], to: [3, 3] },
  { id: "hanami", name: "お花見", from: [3, 20], to: [4, 10] },
  { id: "kodomo", name: "こどもの日", from: [4, 25], to: [5, 5] },
  { id: "tanabata", name: "七夕", from: [7, 1], to: [7, 7] },
  { id: "tsukimi", name: "お月見", from: [9, 10], to: [9, 25] },
  { id: "halloween", name: "ハロウィン", from: [10, 15], to: [10, 31] },
  { id: "christmas", name: "クリスマス", from: [12, 10], to: [12, 25] },
];
const monthDay = (date: Date) => {
  const [m, d] = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(date).split("/").map(Number);
  return (m ?? 1) * 100 + (d ?? 1);
};
/** いまの行事（日本時間）。なければ null */
export function roomEventOf(date: Date): (typeof ROOM_EVENTS)[number] | null {
  const md = monthDay(date);
  return ROOM_EVENTS.find((e) => md >= e.from[0] * 100 + e.from[1] && md <= e.to[0] * 100 + e.to[1]) ?? null;
}
/** つぎの行事 */
export function nextRoomEvent(date: Date): (typeof ROOM_EVENTS)[number] {
  const md = monthDay(date);
  return ROOM_EVENTS.find((e) => e.from[0] * 100 + e.from[1] > md) ?? ROOM_EVENTS[0]!;
}
