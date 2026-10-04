"use client";

/**
 * わんこのおへや
 * =============================================================
 * ふだんは「見るモード」：犬が暮らしていて、写真をタップすると思い出（場所・日付・ひとこと）が見られる。
 * 「もようがえ」で編集モードになり、下の引き出しから飾るものを置いたり、壁紙・床などを変えたりできる。
 * 動かすと少しあとに自動で保存する（DBが未適用の環境では端末に保存する）。
 */
import type { StepDay } from "@/lib/data/exp";
import { LikeButton, RoomGuests, useVisit, VisitPanel, type RoomFriend, type RoomMailItem, type VisitState } from "./room-visit";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconChevronLeft } from "@/components/icons";
import type { DogSkinId } from "@/lib/dog-skins";
import type { GachaRarity } from "@/lib/gacha/config";
import { CURTAIN_STYLES, FLOOR_STYLES, ROOM_KIND_STYLES, RUG_STYLES, WALLPAPER_STYLES } from "@/lib/room/themes";
import {
  clamp,
  CURTAINS,
  DEFAULT_THEME,
  depthScale,
  FLOORS,
  FRAME_STYLES,
  isHanging,
  parseRoomLayout,
  ROOM,
  ROOM_MAX_ITEMS,
  ROOM_MAX_PHOTOS,
  ROOM_PHOTO_TITLE_MAX,
  RUGS,
  FURNITURE,
  FURNITURE_ENTRIES,
  FIXTURE_ENTRIES,
  SOUVENIR_KEYS,
  SOUVENIR_MAX,
  souvenirEntries,
  defaultFixtures,
  fixtureKey,
  resolvePlacements,
  roomEventOf,
  nextRoomEvent,
  freeShelfSpot,
  WALL_DECOS,
  type WallDeco,
  settle,
  uploadEntry,
  uploadKey,
  WALLPAPERS,
  type DecorEntry,
  type DecorKind,
  type FixtureId,
  type FurnitureId,
  type Placement,
  type RoomLayout,
  type RoomShop,
  type RoomKind,
  type ShopId,
  type ThemeGoodId,
  type ThemePart,
  capToOwned,
  cleanDogName,
  DOG_NAME_MAX,
  isFreeTheme,
  isThemeGoodId,
  ownedTheme,
  roomBundle,
  themeGood,
  themeGoodId,
  THEME_PRICES,
  FIXTURE_IDS,
  FURNITURE_IDS,
  shopName,
  type RoomPhoto,
  type RoomStyle,
  type RoomTheme,
  ROOM_KINDS,
  ROOM_PRESETS,
  ROOM_STYLES,
} from "@/lib/room/types";
import { DecorVisual, FRAME_LABELS } from "./decor-visual";
import type { FurnitureFx } from "./furniture-art";
import { RoomDog } from "./room-dog";
import { SouvenirArt } from "./souvenir-art";
import { headline, SouvenirBook, SouvenirGift, type SouvenirNews } from "./souvenir-ui";
import { ownedKey, pendingSouvenirs, pruneBrought, SOUVENIR_ACTS, SOUVENIRS, souvenirKey, souvenirName, type SouvenirId } from "@/lib/room/souvenirs";
import { composeRoomSnapshot } from "./room-snapshot";
import { skyAt } from "@/lib/room/sun";
import { parseRoomWeather, withWeather, type RoomWeather } from "@/lib/room/weather";
import { EVENT_FLOOR_Y, EventFloor, EventFront } from "./room-events";
import { dayPhaseOf, FixtureVisual, fixtureSize, lampsOn, ROOM_STAGE, RoomLighting, RoomScene, ThemeSwatch, windowRectOf, type DayPhase } from "./room-scene";
import { RoomBoard } from "./room-board";
import { BlueCoinBar, BuyDialog, FurnitureShop } from "./room-shop";
import { BlueCoinArt } from "@/components/coin-art";
import { CLEAN_STEPS, DiaryDialog, DogNameCard, DoodleContext, PasserLink, PlantContext, RoomDust, RoomMess, roomDirtOf, ShootingStars, sleepoverGuest, usePlantCare, useRoomMess, useWindowPasser } from "./room-gimmicks";
import { DEFAULT_PLACE, locateHere, placeShortName, SkyCard, skyBackdrop, type RoomPlace } from "./sky-card";

type Tab = DecorKind | "theme";
type ItemFilter = "all" | "toy" | "food" | "interior" | "other" | "sushi";
type SaveState = "saved" | "dirty" | "saving" | "local" | "error";

const LOCAL_KEY = "odekake-my-room-v1";
/** サーバーにまだ送れていない変更の下書き（持ち主ごと） */
const DRAFT_KEY = "odekake-my-room-draft";
const HISTORY_LIMIT = 30;
const AUTOSAVE_MS = 1200;
const RARITY_ORDER: readonly GachaRarity[] = ["N", "R", "SR", "SSR", "UR", "LR", "MR"];

const TABS: Array<{ id: Tab; label: string; empty: string }> = [
  { id: "item", label: "アイテム", empty: "ガチャやミニゲームで図鑑アイテムを集めると、ここから置けます" },
  { id: "photo", label: "写真", empty: "" },
  { id: "trophy", label: "トロフィー", empty: "おさんぽフレンチーで遊ぶと、道ごとのトロフィーがもらえます" },
  { id: "pennant", label: "ペナント", empty: "おでかけを記録した都道府県のペナントがもらえます" },
  { id: "souvenir", label: "おみやげ", empty: "1日3,000歩から1,000歩ごとに、わんこがおさんぽのおみやげを持って帰ってきます" },
  { id: "fixture", label: "窓・棚", empty: "" },
  { id: "furniture", label: "家具", empty: "" },
  { id: "theme", label: "もようがえ", empty: "" },
];
const ITEM_FILTERS: Array<{ id: ItemFilter; label: string }> = [
  { id: "all", label: "すべて" }, { id: "toy", label: "おもちゃ" }, { id: "food", label: "食べもの" },
  { id: "interior", label: "インテリア" }, { id: "sushi", label: "寿司" }, { id: "other", label: "その他" },
];
const RARITY_STYLE: Record<GachaRarity, string> = {
  N: "bg-[#71a95c]", R: "bg-[#659ed0]", SR: "bg-[#b38dd5]", SSR: "bg-[#d9a332]", UR: "bg-[#d9627e]", LR: "bg-[#70589d]",
  MR: "bg-gradient-to-r from-[#5b49a7] via-[#8274e0] to-[#34a9bd]",
};

const newId = () => (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const fmtDate = (d: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d); return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : ""; };

/** 置いたものの幅（部屋の幅に対する %）。床の奥ほど小さく、棚の上は小さめ（棚の大きさに合わせて変わる） */
function widthOf(entry: DecorEntry, p: Placement & { k?: number }, style: RoomStyle): number {
  if (entry.kind === "photo") return 21 * p.scale;
  if (entry.kind === "furniture") return FURNITURE[entry.furniture].width * p.scale * depthScale(p.y);
  if (entry.kind === "pennant") return 19 * p.scale;
  if (entry.kind === "fixture") return fixtureSize(entry.fixture, style).w * p.scale;
  const onShelf = Boolean(p.on);
  const base = entry.kind === "trophy" ? (onShelf ? 12 : 13) : entry.kind === "souvenir" ? (onShelf ? 9 : 10.5) : onShelf ? 11.5 : 15.5;
  return base * p.scale * (onShelf ? (p.k ?? 1) : depthScale(p.y));
}

/** 壁に掛けるものを置く候補（窓・時計・棚をさけた場所） */
const WALL_SPOTS = [[48, 23], [48, 41], [21, 47], [60, 12], [91, 12], [35, 48], [8, 47]] as const;
/** 天井のライトのまわり（壁に物を掛けにくい）。[x0, y0, x1, y1] */
const LAMP_BLOCK = [43, 0, 57, 12] as const;

/** 窓・棚・時計などが場所をとっている範囲（部屋の %） */
function fixtureBlocks(items: readonly Placement[], style: RoomStyle): (readonly [number, number, number, number])[] {
  return items.flatMap((p) => {
    const id = p.key.startsWith("fixture:") ? (p.key.slice("fixture:".length) as FixtureId) : null;
    if (!id) return [];
    const z = fixtureSize(id, style);
    const w = z.w * p.scale * 0.8, h = z.h * p.scale * 0.8 / ROOM.aspect;
    return [[p.x - w * z.ax, p.y - h * z.ay - (id === "shelf" ? 12 * p.scale : 0), p.x + w * (1 - z.ax), p.y + h * (1 - z.ay)] as const];
  });
}

/** 壁に掛けるものの置き場所：窓などに重ならず、すでに掛けてあるものからいちばん離れたところ */
function freeWallSpot(taken: readonly { x: number; y: number }[], fixtures: readonly (readonly [number, number, number, number])[]): [number, number] {
  const blocks = [LAMP_BLOCK, ...fixtures];
  // 写真1枚ぶんの大きさ（幅21% × 高さ約16%）の四角で考える
  const hw = 11, hh = 8;
  const overlap = (ax0: number, ay0: number, ax1: number, ay1: number, bx0: number, by0: number, bx1: number, by1: number) =>
    Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0)) * Math.max(0, Math.min(ay1, by1) - Math.max(ay0, by0));
  let best: [number, number] = [WALL_SPOTS[0][0], WALL_SPOTS[0][1]], bestScore = -Infinity;
  for (let x = 14; x <= 86; x += 2) {
    for (let y = 10; y <= ROOM.wallBottom - 3; y += 2) {
      const box = [x - hw, y - hh, x + hw, y + hh] as const;
      const blocked = blocks.reduce((sum, [x0, y0, x1, y1]) => sum + overlap(...box, x0, y0, x1, y1), 0);
      const crowd = taken.reduce((sum, t) => sum + overlap(...box, t.x - hw, t.y - hh, t.x + hw, t.y + hh), 0);
      const near = taken.length ? Math.min(...taken.map((t) => Math.hypot(t.x - x, (t.y - y) * 1.4))) : 40;
      const score = Math.min(near, 40) - blocked * 0.2 - crowd * 0.3 - Math.abs(x - 50) * 0.03;
      if (score > bestScore) { bestScore = score; best = [x, y]; }
    }
  }
  return best;
}

/** 家具の奥行き（床の上で場所をとる高さ。幅に対する割合） */
const PLACE_KEY = "odekake-room-place-v1";
/** 家具の絵の 高さ÷幅（furniture-art.tsx の viewBox） */
const FURNITURE_RATIO: Record<FurnitureId, number> = { kotatsu: 158 / 240, fishbowl: 168 / 110, tv: 180 / 230, piano: 230 / 240, "rocking-chair": 210 / 160, toybox: 146 / 180, birdcage: 222 / 124, hamster: 150 / 170, record: 176 / 160, fireplace: 204 / 220, fan: 196 / 104, gacha: 196 / 124, whiteboard: 200 / 160, sofa: 150 / 260, "dog-bed": 110 / 190, plant: 190 / 120, bookshelf: 210 / 150, lamp: 220 / 90, table: 120 / 200, "dog-house": 190 / 200, bowl: 58 / 100 };
/** 犬が遊んでいるあいだの家具の動き（ゆれる・明かりがつく など） */
const FX_CLASS: Partial<Record<FurnitureFx, string>> = { wobble: "room-fx-wobble", sway: "room-fx-sway", squish: "room-fx-squish", clatter: "room-fx-clatter", spin: "room-fx-clatter", swing: "room-fx-swing", rock: "room-fx-rock", hop: "room-fx-hop" };
/** タップしたときの動き（専用の遊びがない家具・かざり） */
function tapMotionOf(entry: DecorEntry, onShelf?: string): { fx: FurnitureFx; ms: number } | null {
  if (isHanging(entry.kind)) return { fx: "swing", ms: 1500 };
  if (entry.kind !== "furniture") return { fx: "hop", ms: 700 };
  switch (entry.furniture) {
    case "sofa": case "dog-bed": case "kotatsu": return { fx: "squish", ms: 700 };
    case "rocking-chair": return { fx: "rock", ms: 3200 };
    case "piano": return { fx: "wobble", ms: 1200 };
    case "toybox": return { fx: "hop", ms: 900 };
    case "bowl": return { fx: "clatter", ms: 600 };
    case "fishbowl": return { fx: "wobble", ms: 1200 };
    case "dog-house": case "table": case "whiteboard": case "bookshelf": return { fx: "wobble", ms: 1200 };
    default: return onShelf ? { fx: "hop", ms: 700 } : null;
  }
}
/** 2匹がいっしょに遊びに行く家具 */
const TOGETHER_KINDS = new Set<string>(["tv", "sofa", "toybox", "kotatsu", "dog-bed", "piano", "fireplace", "record", "fishbowl", "bowl"]);
/** お客さんのわんこの寝言 */
const GUEST_DREAMS = ["むにゃ… おうちの ベッド…", "あしたも あそぼ…", "おやつ… はんぶんこ…"];
/** 暖炉のマントルピースのかざり（タップで順に切りかえ。この端末に覚えておく） */
const MANTEL_KEY = "odekake-room-mantel";
/** 消してあるテレビ（この端末に覚えておく） */
const TV_KEY = "odekake-room-tv-off";
const MANTEL_DECOS = ["socks", "candles", "plain"] as const;
const MANTEL_NAMES: Record<(typeof MANTEL_DECOS)[number], string> = { socks: "くつしたと ガーランド", candles: "キャンドルと 絵", plain: "時計と 本" };
/** ガチャのカプセルの中身（部屋の中だけの おたのしみ。持ち物にはならない） */
const GACHA_PRIZES = ["ちいさな ほねのキーホルダー", "にくきゅうシール", "ミニミニボール", "ぴかぴかバッジ", "おさんぽ おまもり", "わんこの消しゴム", "ちいさな王冠"];
const anyOf = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
const FURNITURE_DEPTH: Record<string, number> = { kotatsu: 0.35, fishbowl: 0.2, tv: 0.25, piano: 0.3, "rocking-chair": 0.25, toybox: 0.25, birdcage: 0.15, hamster: 0.25, record: 0.25, fireplace: 0.3, fan: 0.15, gacha: 0.2, whiteboard: 0.2, sofa: 0.35, plant: 0.2, bookshelf: 0.25, lamp: 0.2, table: 0.3, "dog-house": 0.35, bowl: 0.2, "dog-bed": 0.3 };

const FLOOR_SPOTS = [[22, 74], [78, 76], [64, 90], [36, 92], [86, 92], [14, 88], [50, 66], [70, 66]] as const;

/** 買う仕組みがあるときは、買った数をこえる家具・窓・棚などを外し（外した棚に乗せていたものは床に下ろす。図鑑アイテムなどはそのまま）、持っていないデザインは標準にもどす */
function ownedOnly(layout: RoomLayout, shop: RoomShop | undefined): RoomLayout {
  if (!shop?.ready) return layout;
  const items = capToOwned(layout.items, shop);
  const theme = ownedTheme(layout.theme, shop);
  return items.length === layout.items.length ? { ...layout, theme } : parseRoomLayout({ ...layout, theme, items, v: 2 });
}

/** はじめて開いたときの部屋：持っているものから少しだけ飾っておく（家具は置かない。「家具」タブから自分で置く） */
function starterLayout(entries: DecorEntry[]): RoomLayout {
  const items: Placement[] = [];
  let z = 1;
  // サーバーと端末で同じ表示になるよう、最初の部屋の id は決まった値にする
  items.push(...defaultFixtures(DEFAULT_THEME.style));
  const put = (key: string, x: number, y: number, shelf?: { id: string; rx: number }) => items.push({ id: `starter-${z}`, key, x, y, scale: 1, flip: false, z: z++, ...(shelf ? { on: shelf.id, rx: shelf.rx } : {}) });
  entries.filter((e) => e.kind === "photo").slice(0, 2).forEach((e, i) => put(e.key, WALL_SPOTS[i]![0], WALL_SPOTS[i]![1]));
  entries.filter((e) => e.kind === "pennant").slice(0, 1).forEach((e) => put(e.key, WALL_SPOTS[2]![0], WALL_SPOTS[2]![1]));
  entries.filter((e) => e.kind === "trophy").slice(0, 3).forEach((e, i) => put(e.key, 66 + i * 12, ROOM.shelves[0].y, { id: "fx-shelf-1", rx: (8 + i * 12) / 35 }));
  const items4 = entries.filter((e): e is Extract<DecorEntry, { kind: "item" }> => e.kind === "item")
    .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)).slice(0, 4);
  items4.forEach((e, i) => (i === 3 ? put(e.key, 70, ROOM.shelves[1].y, { id: "fx-shelf-2", rx: 12 / 35 }) : put(e.key, FLOOR_SPOTS[i]![0], FLOOR_SPOTS[i]![1])));
  return { theme: DEFAULT_THEME, items, photos: [], v: 2 };
}

const todayJst = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());

/** 端末で選んだ写真を、長い辺が max px の JPEG に縮める（向きは写真の情報どおり） */
async function shrinkImage(file: File, max: number, quality: number): Promise<Blob> {
  let source: CanvasImageSource & { width: number; height: number };
  let close = () => {};
  try {
    const bitmap = await createImageBitmap(file);
    source = bitmap; close = () => bitmap.close();
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    source = img; close = () => URL.revokeObjectURL(url);
  }
  const k = Math.min(1, max / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * k));
  canvas.height = Math.max(1, Math.round(source.height * k));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality));
}

/** ボードの最初の置き場所：部屋の下いっぱい（高さは置ける範囲まで自動でちぢむ） */

export function MyRoom({ entries, initialLayout, serverReady, dogSkin, dogName, serverNow, steps, stepHistory, visit, guests, shop, ownerId }: {
  entries: DecorEntry[];
  initialLayout: RoomLayout | null;
  serverReady: boolean;
  dogSkin: DogSkinId;
  dogName: string;
  /** サーバーで描いた時刻。最初の表示をサーバーとそろえ、そのあと端末の時刻に合わせる */
  serverNow: string;
  /** きょうの歩数（サーバーで描いた値。あとは 30 秒ごとに取り直す） */
  steps?: { steps: number | null; stepExp: number; coinBalance: number };
  /** 直近の日ごとの歩数（今週のグラフ） */
  stepHistory?: StepDay[];
  /** フレンドの部屋にあそびに来ているとき（見るだけ。保存もしない） */
  visit?: VisitState;
  /** 自分の部屋に届いた「いいね」・置き手紙と、あそびに行けるフレンド */
  guests?: { mail: RoomMailItem[]; friends: RoomFriend[] };
  /** 家具のお店（持っている家具・青コイン）。無ければ、これまでどおり家具は自由に置ける */
  shop?: RoomShop;
  /** 部屋の持ち主（端末に残す下書きを、アカウントごとに分ける） */
  ownerId?: string;
}) {
  // 家具はだれでも置けるので、持ち物と合わせて「置けるもの」にする
  const validKeys = useMemo(() => new Set([...[...entries, ...FURNITURE_ENTRIES, ...FIXTURE_ENTRIES].map((e) => e.key), ...SOUVENIR_KEYS]), [entries]);
  const [layout, setLayout] = useState<RoomLayout>(() => ownedOnly(initialLayout
    ? { ...initialLayout, items: initialLayout.items.filter((p) => validKeys.has(p.key) || p.key.startsWith("upload:")) }
    : starterLayout(entries), shop));
  /** わんこの名前（部屋に保存した名前。なければ「わんこ」） */
  const petName = layout.dogName ?? dogName;
  /** 持ち物に、アップロードした写真を足したもの（アップロードした写真を先に並べる） */
  const allEntries = useMemo(() => [...layout.photos.map(uploadEntry), ...entries, ...FURNITURE_ENTRIES, ...FIXTURE_ENTRIES, ...souvenirEntries(layout.souvenirs)], [entries, layout.photos, layout.souvenirs]);
  /** 棚に乗せたものの位置を、棚の位置と大きさから決めたもの（描く・動かすときはこちらを使う） */
  const placedItems = useMemo(() => resolvePlacements(layout.items), [layout.items]);
  const shelfList = useMemo(() => layout.items.filter((p) => p.key === fixtureKey("shelf")), [layout.items]);
  const style = layout.theme.style;
  const entryByKey = useMemo(() => new Map(allEntries.map((e) => [e.key, e])), [allEntries]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [past, setPast] = useState<RoomLayout[]>([]);
  const [future, setFuture] = useState<RoomLayout[]>([]);
  const [editing, setEditing] = useState(false);
  const visitLike = useVisit(visit ?? { friendId: "", name: "", liked: false, likeCount: 0, myNotes: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** ドラッグ中のものを乗せようとしている棚（光らせる） */
  const [dropShelf, setDropShelf] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("item");
  const [filter, setFilter] = useState<ItemFilter>("all");
  const [saveState, setSaveState] = useState<SaveState>(serverReady ? "saved" : "local");
  const [toast, setToast] = useState<string | null>(null);
  const [shopState, setShopState] = useState<RoomShop | null>(shop ?? null);
  /** 本だなの日記を開いている */
  const [diary, setDiary] = useState(false);
  /** わんこに反応してもらうこと（日記を開いた・散らかったものを片づけた など） */
  const [dogCue, setDogCue] = useState<{ id: number; text: string; pose?: string } | null>(null);
  /** タップした家具へ、わんこを呼ぶ（遊びに来ているフレンドのわんこも、いっしょに来る） */
  const [dogCall, setDogCall] = useState<{ id: number; furnitureId: string } | null>(null);
  const [guestCall, setGuestCall] = useState<{ id: number; furnitureId: string } | null>(null);
  const callDogs = useCallback((furnitureId: string) => {
    const id = Date.now();
    setDogCall({ id, furnitureId });
    setGuestCall({ id, furnitureId });
  }, []);
  /** 置いたものの上に少し出す文字（名前や、インコのおしゃべり） */
  const [peek, setPeek] = useState<{ id: string; text: string; x: number; y: number; bird?: boolean } | null>(null);
  const [lightbox, setLightbox] = useState<Extract<DecorEntry, { kind: "photo" }> | null>(null);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [shooting, setShooting] = useState(false);
  const [shareBody, setShareBody] = useState("");
  const [shareState, setShareState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [shareError, setShareError] = useState("");
  const [now, setNow] = useState(() => new Date(serverNow));
  /** 部屋の台（飾りと犬の位置の基準。% で置く） */
  const roomRef = useRef<HTMLDivElement | null>(null);
  /** 画面に見えている外わく（記念撮影はこの範囲） */
  const frameRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; before: RoomLayout; moved: boolean; pointer: number } | null>(null);
  const latest = useRef(layout);
  latest.current = layout;
  const [place, setPlace] = useState<RoomPlace>(DEFAULT_PLACE);
  /** 端末に保存した場所を読み終えたか（読む前に東京の天気を取りに行かないため） */
  const [placeReady, setPlaceReady] = useState(false);
  const phase: DayPhase = dayPhaseOf(now, place);
  /** お天気ボードに書く場所の名前（「岐阜」など） */
  const placeName = placeShortName(place);

  const [weather, setWeather] = useState<RoomWeather | null>(null);
  /** 犬が遊んでいる家具の動き（置いたものの id → 動き） */
  const [furnitureFx, setFurnitureFx] = useState<Record<string, FurnitureFx>>({});
  const onFurnitureFx = useCallback((id: string, fx: FurnitureFx | null) => {
    setFurnitureFx((cur) => {
      if (!fx) { if (!(id in cur)) return cur; const next = { ...cur }; delete next[id]; return next; }
      return cur[id] === fx ? cur : { ...cur, [id]: fx };
    });
  }, []);
  /** いまの行事（もようがえでオフにしていれば null） */
  const roomEvent = layout.theme.events === false ? null : roomEventOf(now)?.id ?? null;
  const skyNow = useMemo(() => withWeather(skyAt(now, place), weather), [now, place, weather]);
  const lightsOn = useMemo(() => lampsOn(skyNow), [skyNow]);
  /** 犬が寝る時間（日本時間の21時〜6時） */
  const sleepy = useMemo(() => { const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hourCycle: "h23" }).format(now)); return h >= 21 || h < 6; }, [now]);

  // 時計と時間帯のために、1分ごとに今の時刻を更新する
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // 空の計算に使う場所（この端末に保存したもの。なければ東京）
  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(PLACE_KEY) ?? "null") as Partial<RoomPlace> | null;
      if (raw && typeof raw.lat === "number" && typeof raw.lon === "number" && Math.abs(raw.lat) <= 90 && Math.abs(raw.lon) <= 180 && typeof raw.pref === "string" && (raw.source === "gps" || raw.source === "pref")) {
        setPlace({
          lat: raw.lat, lon: raw.lon, source: raw.source, pref: raw.pref,
          ...(typeof raw.city === "string" ? { city: raw.city.slice(0, 20) } : {}),
          ...(typeof raw.acc === "number" ? { acc: raw.acc } : {}),
        });
        // 現在地を使っていて、位置情報がもう許可されていれば、ひらくたびに正確な場所を取り直す（許可を聞く画面は出さない）
        if (raw.source === "gps" && navigator.permissions?.query) {
          navigator.permissions.query({ name: "geolocation" as PermissionName })
            .then((st) => { if (st.state === "granted") return locateHere().then(changePlaceRef.current); })
            .catch(() => { /* とれなければ前の場所のまま */ });
        }
      }
    } catch { /* 読めなければ東京のまま */ }
    setPlaceReady(true);
  }, []);
  // 窓の外の、いまの本当の天気（20分ごとに取り直す。取れなければ季節だけの景色）
  useEffect(() => {
    if (!placeReady) return;
    let alive = true;
    const load = () => {
      fetch(`/api/my-room/weather?lat=${place.lat.toFixed(2)}&lon=${place.lon.toFixed(2)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (alive) setWeather(parseRoomWeather(j)); })
        .catch(() => { if (alive) setWeather(null); });
    };
    load();
    const t = window.setInterval(load, 20 * 60_000);
    return () => { alive = false; window.clearInterval(t); };
  }, [placeReady, place.lat.toFixed(2), place.lon.toFixed(2)]); // eslint-disable-line react-hooks/exhaustive-deps -- 1km より細かい動きでは取り直さない
  const changePlace = useCallback((p: RoomPlace) => {
    setPlace(p);
    try { window.localStorage.setItem(PLACE_KEY, JSON.stringify(p)); } catch { /* 保存できなくてもこの画面では使える */ }
  }, []);
  const changePlaceRef = useRef(changePlace);
  changePlaceRef.current = changePlace;

  // サーバーに保存できない環境では、端末に残っている部屋を使う
  useEffect(() => {
    if (serverReady || initialLayout) return;
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (raw) setLayout(parseRoomLayout(JSON.parse(raw), validKeys));
    } catch { /* 読めなければ最初の部屋のまま */ }
  }, [initialLayout, serverReady, validKeys]);

  const flash = useCallback((text: string) => { setToast(text); window.setTimeout(() => setToast(null), 1800); }, []);

  /* ---------- 保存 ---------- */
  // 保存は1つずつ順番に送り、送るたびに rev（送った時刻）をつける。サーバーは、もっと新しい rev が
  // 入っていれば古い保存を捨てる（通信の順番が入れかわっても、新しい飾り方が古いもので上書きされない）。
  // まだ送れていない変更は、この端末にも下書きとして残し、次に開いたとき（戻るボタンで古い画面が出たときも）に使う。
  // 送り終わったあとも「最後に送った飾り方」として残しておく。フレンドの部屋から戻ったときなどに、
  // 画面の使い回しで送る前の古い飾り方が出ても、こちらのほうが新しければ、こちらを使う。
  const draftKey = `${DRAFT_KEY}:${ownerId ?? "me"}`;
  /** 端末に残した飾り方を書きかえる（いま残っているものより古ければ、書きかえない） */
  const keepLocal = useCallback((rev: number, snapshot: RoomLayout, saved: boolean) => {
    try {
      const d = JSON.parse(window.localStorage.getItem(draftKey) ?? "null") as { rev?: number } | null;
      if (d && (d.rev ?? 0) > rev) return;
      window.localStorage.setItem(draftKey, JSON.stringify({ rev, layout: snapshot, saved }));
    } catch { /* 残せない端末 */ }
  }, [draftKey]);
  const saving = useRef(false);
  const persist = useCallback(async () => {
    const snapshot = latest.current;
    if (!serverReady) {
      try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot)); setSaveState("local"); } catch { setSaveState("error"); }
      return;
    }
    // 前の保存がまだ終わっていなければ、終わってから送る
    if (saving.current) return;
    saving.current = true;
    setSaveState("saving");
    const rev = Date.now();
    try {
      const response = await fetch("/api/my-room", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout: { ...snapshot, rev } }) });
      if (!response.ok) throw new Error("save failed");
      const payload = (await response.json().catch(() => null)) as { ready?: boolean; stale?: boolean } | null;
      if (payload?.ready === false) { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot)); setSaveState("local"); return; }
      const done = latest.current === snapshot;
      if (payload?.stale) {
        // ほかの端末で、もっと新しい飾り方が保存されていた。端末に残した古い飾り方は使わない
        try { const d = JSON.parse(window.localStorage.getItem(draftKey) ?? "null") as { rev?: number } | null; if (!d || (d.rev ?? 0) <= rev) window.localStorage.removeItem(draftKey); } catch { /* 消せなくても困らない */ }
      } else if (done) keepLocal(rev, snapshot, true);
      setSaveState(done ? "saved" : "dirty");
    } catch {
      setSaveState("error");
    } finally {
      saving.current = false;
      // 送っているあいだに変えた分は、つづけて送る
      if (latest.current !== snapshot) window.setTimeout(() => { void persistRef.current(); }, 300);
    }
  }, [draftKey, keepLocal, serverReady]);
  const persistRef = useRef(persist);
  persistRef.current = persist;
  // 変えたら、まず端末に下書きを残す（自分の部屋だけ）
  useEffect(() => {
    if (saveState !== "dirty" || !serverReady || visit) return;
    keepLocal(Date.now(), latest.current, false);
  }, [keepLocal, layout, saveState, serverReady, visit]);
  // 開いたとき、サーバーの飾り方より新しいものが端末にあれば、そちらを使う（まだ送れていなければ送りなおす）
  useEffect(() => {
    if (!serverReady || visit) return;
    try {
      const d = JSON.parse(window.localStorage.getItem(draftKey) ?? "null") as { rev?: number; layout?: unknown; saved?: boolean } | null;
      if (!d?.layout || typeof d.rev !== "number") return;
      // サーバーのほうが新しい（ほかの端末で変えた など）か、同じなら、サーバーの飾り方のまま
      if (d.rev <= (initialLayout?.rev ?? 0)) { if (!d.saved) window.localStorage.removeItem(draftKey); return; }
      const restored = ownedOnly(parseRoomLayout(d.layout, validKeys), shop);
      latest.current = restored;
      setLayout(restored);
      // 送り終わっているもの（画面の使い回しで古い飾り方が出ただけ）は、送りなおさない
      setSaveState(d.saved ? "saved" : "dirty");
    } catch { /* 読めなければサーバーの飾り方のまま */ }
    // 開いたときに1回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (saveState !== "dirty") return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void persist(); }, AUTOSAVE_MS);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [layout, saveState, persist]);
  // 自動保存の前にページを離れても、変えた分を送っておく
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;
  useEffect(() => {
    const flush = () => {
      if (saveStateRef.current !== "dirty") return;
      saveStateRef.current = "saving";
      // 送れたかどうかは分からないので、端末には「まだ送れていない」として残す（次に開いたとき、古ければ送りなおす）
      if (serverReady) { const rev = Date.now(); keepLocal(rev, latest.current, false); void fetch("/api/my-room", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout: { ...latest.current, rev } }), keepalive: true }); }
      else try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(latest.current)); } catch { /* 保存できない端末 */ }
    };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [keepLocal, serverReady]);

  /* ---------- 変更 ---------- */
  const readOnly = !!visit;
  /** ふだんの見る画面（部屋 → 手前の床 → ボード） */
  const stage = !editing && !visit;
  const stageRef = useRef<HTMLDivElement>(null);
  const commit = useCallback((next: RoomLayout, before: RoomLayout = latest.current) => {
    // フレンドの部屋は見るだけ
    if (readOnly) return;
    setPast((p) => [...p.slice(-(HISTORY_LIMIT - 1)), before]);
    setFuture([]);
    setLayout(next);
    setSaveState("dirty");
  }, [readOnly]);
  const changeItem = (id: string, change: (p: Placement) => Placement) => commit({ ...layout, items: layout.items.map((p) => (p.id === id ? change(p) : p)) });
  const setTheme = (patch: Partial<RoomTheme>) => commit({ ...layout, theme: { ...layout.theme, ...patch } });
  const topZ = () => Math.max(0, ...layout.items.map((p) => p.z)) + 1;

  function addEntry(entry: DecorEntry, base: RoomLayout = layout) {
    const placed = base.items.filter((p) => p.key === entry.key);
    if (placed.length >= entry.count) { setSelectedId(placed[0]?.id ?? null); flash(entry.count > 1 ? "持っている数だけ置いています" : "もう飾っています"); return; }
    if (base.items.length >= ROOM_MAX_ITEMS) { if (base !== layout) commit(base); flash(`飾れるのは${ROOM_MAX_ITEMS}こまでです`); return; }
    let x: number, y: number;
    let shelfAt: { on: string; rx: number } | null = null;
    if (isHanging(entry.kind)) {
      const hanging = base.items.filter((p) => { const e = entryByKey.get(p.key); return (e && isHanging(e.kind) && e.kind !== "fixture") || p.key.startsWith("upload:"); });
      [x, y] = freeWallSpot(hanging, fixtureBlocks(base.items, base.theme.style));
    } else if (entry.kind === "trophy" && base.items.some((p) => p.key === fixtureKey("shelf"))) {
      // トロフィーは、乗せているものがいちばん少ない棚に並べる
      const shelves = base.items.filter((p) => p.key === fixtureKey("shelf"));
      const load = (s: Placement) => base.items.filter((p) => p.on === s.id).length;
      const shelf = shelves.reduce((a, b) => (load(b) < load(a) ? b : a));
      shelfAt = { on: shelf.id, rx: freeShelfSpot(shelf.id, base.items) };
      [x, y] = [shelf.x, shelf.y];
    } else {
      const n = base.items.length;
      [x, y] = FLOOR_SPOTS[n % FLOOR_SPOTS.length]!;
      x = clamp(x + ((n * 7) % 9) - 4, 6, 94);
    }
    const p: Placement = { id: newId(), key: entry.key, x, y, scale: 1, flip: false, z: topZ(), ...(entry.kind === "photo" ? { frame: "wood" as const } : {}), ...(shelfAt ?? {}) };
    commit({ ...base, items: [...base.items, p] });
    setSelectedId(p.id);
  }

  /* ---------- 端末の写真をアップロードして飾る ---------- */
  async function uploadPhoto(file: File) {
    if (layout.photos.length >= ROOM_MAX_PHOTOS) { flash(`アップロードできる写真は${ROOM_MAX_PHOTOS}枚までです`); return; }
    setUploading(true);
    try {
      const [image, thumb] = await Promise.all([shrinkImage(file, 1600, 0.86), shrinkImage(file, 480, 0.8)]);
      const form = new FormData();
      form.append("image", image, "photo.jpg");
      form.append("thumb", thumb, "thumb.jpg");
      const response = await fetch("/api/my-room/photo", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as { id?: string; path?: string; error?: string } | null;
      if (!response.ok || !payload?.id || !payload.path) throw new Error(payload?.error ?? "写真を保存できませんでした。");
      const photo: RoomPhoto = { id: payload.id, path: payload.path, date: todayJst(), title: "" };
      const base = { ...latest.current, photos: [photo, ...latest.current.photos] };
      addEntry(uploadEntry(photo), base);
      flash("写真を飾りました");
    } catch (error) {
      flash(error instanceof Error && error.message !== "encode failed" && error.message !== "no canvas" ? error.message : "この写真は読みこめませんでした");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  function removeUpload(photo: RoomPhoto) {
    if (!window.confirm("この写真をおへやから消しますか？（元に戻せません）")) return;
    const key = uploadKey(photo.id);
    setLayout((cur) => ({ ...cur, photos: cur.photos.filter((ph) => ph.id !== photo.id), items: cur.items.filter((p) => p.key !== key) }));
    // 消した写真を「元に戻す」で呼び戻せないよう、履歴から外す
    setPast([]); setFuture([]);
    setSelectedId(null);
    setSaveState("dirty");
    void fetch("/api/my-room/photo", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: photo.path }) }).catch(() => null);
  }
  function renameUpload(photoId: string) {
    const photo = layout.photos.find((ph) => ph.id === photoId);
    if (!photo) return;
    const title = window.prompt(`写真のなまえ（${ROOM_PHOTO_TITLE_MAX}文字まで）`, photo.title);
    if (title === null) return;
    commit({ ...layout, photos: layout.photos.map((ph) => (ph.id === photoId ? { ...ph, title: title.trim().slice(0, ROOM_PHOTO_TITLE_MAX) } : ph)) });
  }

  const undo = () => { const prev = past.at(-1); if (!prev) return; setFuture((f) => [layout, ...f].slice(0, HISTORY_LIMIT)); setPast((p) => p.slice(0, -1)); setLayout(prev); setSelectedId(null); setSaveState("dirty"); };
  const redo = () => { const next = future[0]; if (!next) return; setPast((p) => [...p, layout].slice(-HISTORY_LIMIT)); setFuture((f) => f.slice(1)); setLayout(next); setSelectedId(null); setSaveState("dirty"); };

  /* ---------- 動かす ---------- */
  const pointerPct = (e: { clientX: number; clientY: number }) => {
    const r = roomRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  function onItemDown(e: React.PointerEvent, p: Placement) {
    const entry = entryByKey.get(p.key);
    if (!entry) return;
    if (!editing) return;
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const at = pointerPct(e);
    drag.current = { id: p.id, dx: at.x - p.x, dy: at.y - p.y, before: layout, moved: false, pointer: e.pointerId };
    setSelectedId(p.id);
  }
  function onItemMove(e: React.PointerEvent, p: Placement) {
    const d = drag.current;
    if (!d || d.id !== p.id || d.pointer !== e.pointerId) return;
    const entry = entryByKey.get(p.key);
    if (!entry) return;
    const at = pointerPct(e);
    const shelves = layout.items.filter((s) => s.key === fixtureKey("shelf") && s.id !== p.id);
    const next = settle(entry.kind, at.x - d.dx, at.y - d.dy, shelves);
    if (!d.moved && Math.hypot(next.x - p.x, next.y - p.y) < 0.8) return;
    d.moved = true;
    setLayout((cur) => ({ ...cur, items: cur.items.map((it) => (it.id === p.id ? { ...it, ...next } : it)) }));
    setDropShelf(next.on ?? null);
  }
  function onItemUp(e: React.PointerEvent, p: Placement) {
    const d = drag.current;
    if (!d || d.id !== p.id) return;
    drag.current = null;
    setDropShelf(null);
    if (d.moved) { setPast((ps) => [...ps.slice(-(HISTORY_LIMIT - 1)), d.before]); setFuture([]); setSaveState("dirty"); }
    void e;
  }
  /** 見るモードでタップ：写真は思い出を開き、ほかは名前を少し出す */
  function onItemTap(p: Placement, el?: HTMLElement) {
    if (editing) return;
    const entry = entryByKey.get(p.key);
    if (!entry) return;
    if (entry.kind === "photo") { setLightbox(entry); return; }
    // フロアランプは、タップでつけたり消したり
    // 観葉植物は、タップで水やり（1日1回）
    if (entry.kind === "furniture" && entry.furniture === "plant" && !visit) {
      fxFor(p.id, "sway", 1800);
      if (water()) { flash(`💧 おみずを あげた！（この1週間で ${plant.days + 1}日目）`); callDogs(p.id); }
      else flash("きょうは もう おみずを あげたよ。また あしたね");
      return;
    }
    // くもった窓は、タップでヒント
    if (entry.kind === "fixture" && entry.fixture === "window" && dirt > 0.3) { dirtHint(); return; }
    if (entry.kind === "furniture" && entry.furniture === "lamp") {
      const on = !lampIsOn(p.id);
      setLampSwitch((cur) => ({ ...cur, [p.id]: on }));
      setDogCue({ id: Date.now(), text: on ? "あかるくなった！" : "まっくら…", pose: on ? "cheer" : "wonder" });
      return;
    }
    if (entry.kind === "furniture") {
      switch (entry.furniture) {
        case "record": {
          // レコードは、タップでかけたり止めたり（かかっていると、わんこが踊る）
          const on = furnitureMode[p.id] !== "on";
          setRecordSwitch((cur) => ({ ...cur, [p.id]: on }));
          if (!on) onFurnitureFx(p.id, null);
          setDogCue({ id: Date.now(), text: on ? "♪ おどっちゃおう！" : "あれ、おわっちゃった", pose: on ? "cheer" : "wonder" });
          return;
        }
        case "tv": {
          const on = furnitureMode[p.id] !== "off";
          setTvOff((cur) => {
            const saved = { ...cur, [p.id]: on };
            try { window.localStorage.setItem(TV_KEY, JSON.stringify(saved)); } catch { /* 覚えられなくても、いまは変わる */ }
            return saved;
          });
          // つけたら、わんこが見に来る
          if (on) setDogCue({ id: Date.now(), text: "あれ、きえちゃった", pose: "wonder" });
          else callDogs(p.id);
          return;
        }
        case "fan": {
          const on = furnitureMode[p.id] !== "on";
          setFanSwitch((cur) => ({ ...cur, [p.id]: on }));
          flash(on ? "扇風機を つけた（カーテンや植物が なびくよ）" : "扇風機を けした");
          return;
        }
        case "fireplace": {
          const cur = (mantel[p.id] ?? mantelDefault) as (typeof MANTEL_DECOS)[number];
          const next = MANTEL_DECOS[(MANTEL_DECOS.indexOf(cur) + 1) % MANTEL_DECOS.length]!;
          setMantel((m) => {
            const saved = { ...m, [p.id]: next };
            try { window.localStorage.setItem(MANTEL_KEY, JSON.stringify(saved)); } catch { /* 覚えられなくても、いまは変わる */ }
            return saved;
          });
          flash(`マントルピースの かざりを かえた（${MANTEL_NAMES[next]}）`);
          return;
        }
        case "birdcage": birdTalk(p.id); return;
        case "hamster": {
          fxFor(p.id, "nibbled", 20_000);
          flash("🌻 ひまわりの種を あげた！ ほっぺが ぱんぱん");
          return;
        }
        case "gacha": {
          if (furnitureFx[p.id] === "spin") return;
          gachaTurn(p.id);
          return;
        }
        default: break;
      }
    }
    // 本だなには、わんこの日記がはさまっている
    if (entry.kind === "furniture" && entry.furniture === "bookshelf" && !visit) {
      if (!furnitureFx[p.id]) fxFor(p.id, "wobble", 1200);
      setDiary(true);
      setDogCue({ id: Date.now(), text: "あっ、ぼくの にっき…よんでもいいよ", pose: "bow" });
      return;
    }
    // 飾ったおみやげは、わんこが見に来て、おみやげごとのしぐさをする
    if (entry.kind === "souvenir" && !furnitureFx[p.id]) { fxFor(p.id, "hop", 700); callDogs(p.id); }
    // そのほかの家具・かざりも、タップすると少し動く（犬が遊んでいる最中の動きはじゃましない）
    const tap = entry.kind === "fixture" || entry.kind === "souvenir" || furnitureFx[p.id] ? null : tapMotionOf(entry, p.on);
    if (tap) {
      fxFor(p.id, tap.fx, tap.ms);
      // 床の家具なら、わんこが遊びに来る（ひとことは、着いてから。名前のふだと重ならないように）
      if (entry.kind === "furniture" && !p.on) callDogs(p.id);
    }
    const text = entry.kind === "item" ? `${entry.rarity} ${entry.name}` : entry.kind === "trophy" ? `${entry.name}　ベスト ${entry.score.toLocaleString("ja-JP")}点（${entry.rank}）` : entry.kind === "pennant" ? `${entry.name}のペナント` : entry.name;
    // 名前は夜の暗さより上に出すので、部屋の中の位置（そのものの上のはし）を覚えておく
    const r = el?.getBoundingClientRect(), room = roomRef.current?.getBoundingClientRect();
    const at = r && room ? { x: ((r.left + r.width / 2 - room.left) / room.width) * 100, y: ((r.top - room.top) / room.height) * 100 } : { x: p.x, y: p.y };
    setPeek({ id: p.id, text, ...at });
    window.setTimeout(() => setPeek((cur) => (cur?.id === p.id ? null : cur)), 2200);
  }

  /* ---------- 描く順番（壁 → 棚 → 床と犬は手前ほど上） ---------- */
  const zIndexOf = useMemo(() => {
    const hanging = layout.items.filter((p) => { const e = entryByKey.get(p.key); return e && isHanging(e.kind); }).sort((a, b) => a.z - b.z);
    const shelved = layout.items.filter((p) => { const e = entryByKey.get(p.key); return e && !isHanging(e.kind) && p.on; }).sort((a, b) => a.z - b.z);
    const map = new Map<string, number>();
    hanging.forEach((p, i) => map.set(p.id, 20 + i));
    shelved.forEach((p, i) => map.set(p.id, 160 + i));
    for (const p of layout.items) if (!map.has(p.id)) map.set(p.id, 300 + Math.round(p.y * 10));
    return map;
  }, [entryByKey, layout.items]);

  const dogLines = useMemo(() => {
    const placed = layout.items.map((p) => entryByKey.get(p.key)).filter((e): e is DecorEntry => Boolean(e) && e!.kind !== "fixture");
    const lines = [phase === "morning" ? "おはよう！ きょうはどこ行く？" : phase === "evening" ? "おかえり！ おさんぽ行こ？" : "わん！ なでてくれてうれしい", "このおへや、だいすき！"];
    for (const e of placed.slice(0, 30)) {
      if (e.kind === "photo") lines.push(`${e.name}、また行きたいね！`);
      else if (e.kind === "trophy") lines.push(`${e.stage}のトロフィー、かっこいいでしょ`);
      else if (e.kind === "pennant") lines.push(`${e.name}の思い出、たのしかったね`);
      else if (e.kind === "souvenir") lines.push(...SOUVENIRS[e.souvenir].talk);
      else lines.push(`${e.name}、気に入ってるよ！`);
    }
    return lines;
  }, [entryByKey, layout.items, phase]);

  /** きょうの日付（日本時間。日記はきのうまで） */
  const todayKey = useMemo(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now), [now]);
  /**
   * おさんぽのおみやげ：歩数の節目（3,000歩から1,000歩ごと）を越えたぶんだけ、わんこが持って帰ってくる。
   * 受け取ったら部屋の飾り方にいっしょに保存する（ほかの端末でも同じ。同じ分は二度もらわない）。自分の部屋だけ
   */
  const [souvenirNews, setSouvenirNews] = useState<SouvenirNews | null>(null);
  /** わんこが口にくわえて見せている おみやげ（カードが出るまで） */
  const [carrying, setCarrying] = useState<{ id: SouvenirId; shiny: boolean } | null>(null);
  useEffect(() => {
    if (visit || editing) return;
    const cur = latest.current;
    const pending = pendingSouvenirs(stepHistory ?? [], steps?.steps, todayKey, cur.brought ?? []);
    if (!pending.length) return;
    const owned = { ...(cur.souvenirs ?? {}) };
    // はじめて見つけた種類には NEW をつける（同じ日に2つ来たら、1つめだけ）
    const news: SouvenirNews = pending.map((p) => {
      const k = ownedKey(p.id, p.shiny);
      const isNew = !owned[k];
      owned[k] = Math.min(SOUVENIR_MAX, (owned[k] ?? 0) + 1);
      return { id: p.id, shiny: p.shiny, steps: p.steps, isNew };
    });
    const next: RoomLayout = { ...cur, souvenirs: owned, brought: pruneBrought([...(cur.brought ?? []), ...pending.map((p) => p.key)], todayKey) };
    latest.current = next;
    setLayout(next);
    setSaveState("dirty");
    // まず、わんこが いちばんのおみやげを くわえて「ただいま！」。少ししてから おみやげ袋が出る
    // （開いてすぐの ほかのひとこと＝お客さんが来た などと重ならないよう、ひとことは少しあと）
    const top = headline(news);
    setCarrying({ id: top.id, shiny: top.shiny });
    const text = top.shiny ? `ただいま！ みて！ 色ちがいの ${SOUVENIRS[top.id].name}！` : pending.length > 1 ? `ただいま！ おみやげ ${pending.length}こ もってきたよ` : `ただいま！ ${SOUVENIRS[top.id].name}を みつけたよ`;
    window.setTimeout(() => setDogCue({ id: Date.now(), text, pose: "stand-happy" }), 2200);
    window.setTimeout(() => { setSouvenirNews(news); setCarrying(null); }, 4400);
  }, [editing, stepHistory, steps?.steps, todayKey, visit]);
  /** 部屋のよごれ（おさんぽをさぼると、窓がくもり、ほこりがたまる。自分の部屋だけ） */
  const dirt = useMemo(() => (visit ? 0 : roomDirtOf(stepHistory ?? [], steps?.steps, todayKey)), [stepHistory, steps?.steps, todayKey, visit]);
  const dirtHint = () => {
    const need = Math.max(0, CLEAN_STEPS - (steps?.steps ?? 0));
    flash(need > 0 ? `ほこりが たまってきたよ。きょう あと${need.toLocaleString()}歩 あるくと ピカピカ！` : "ピカピカ！");
  };
  /** 観葉植物の水やり（この端末に保存） */
  const { plant, water } = usePlantCare(todayKey);
  /** フレンドのわんこが遊びに来る日（土曜の朝10時〜日曜の朝10時。そのままおとまり。自分の部屋だけ） */
  const guest = useMemo(() => (visit || editing ? null : sleepoverGuest(now, guests?.friends ?? [])), [editing, guests?.friends, now, visit]);
  const guestId = guest?.id ?? null;
  useEffect(() => {
    if (!guestId || !guest) return;
    setDogCue({ id: Date.now(), text: `きょうは ${[...guest.name].slice(0, 6).join("")}さんちの わんこが あそびに来たよ！`, pose: "cheer" });
    // お客さんが来たときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestId]);
  /** お客さんのわんこが言うこと */
  const guestLines = useMemo(() => {
    if (!guest) return [];
    const owner = [...guest.name].slice(0, 6).join("");
    return [`${owner}さんちから 来たよ！`, "おじゃまします！", "このおへや、すてきだね", "いっしょに あそぼ！", `${guest.dogName ?? "ぼく"}だよ。よろしくね`, "きょうは おとまり なんだ〜"];
  }, [guest]);
  /** お客さんのわんこの名ふだ（タップしたとき） */
  const [guestCard, setGuestCard] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!guestCard) return;
    const t = window.setTimeout(() => setGuestCard(null), 4000);
    return () => window.clearTimeout(t);
  }, [guestCard]);
  // ときどき、2匹でいっしょに同じ家具で遊ぶ（起きているあいだ）
  const playTogether = useRef<() => void>(() => {});
  playTogether.current = () => {
    const spots = dogPlaces.furniture.filter((f) => TOGETHER_KINDS.has(f.kind));
    if (!spots.length) return;
    callDogs(spots[Math.floor(Math.random() * spots.length)]!.id);
  };
  useEffect(() => {
    if (!guestId || sleepy || editing) return;
    let t = 0;
    const loop = () => { playTogether.current(); t = window.setTimeout(loop, 35_000 + Math.random() * 25_000); };
    t = window.setTimeout(loop, 12_000 + Math.random() * 8_000);
    return () => window.clearTimeout(t);
  }, [editing, guestId, sleepy]);
  /** ホワイトボードのらくがき（きょうの日付・天気・歩数で変わる） */
  const doodleInfo = useMemo(() => ({ now, weather: weather?.kind ?? null, steps: visit ? null : steps?.steps, dogName: petName }), [now, weather?.kind, visit, steps?.steps, petName]);
  /** 寝言（きょうの歩数や、部屋にあるもの・おやつの夢） */
  const dogDreams = useMemo(() => {
    const dreams = ["ジャーキー…3本…", "ボール…まてまて〜…", "おさんぽ…もう1周…", "ごしゅじん…だいすき…", "それ…ぼくの…おやつ…"];
    if (steps?.steps) dreams.push(`${steps.steps.toLocaleString()}歩…まだ あるけるよ…`);
    for (const p of layout.items) {
      const e = entryByKey.get(p.key);
      if (e && (e.kind === "item" || e.kind === "furniture")) dreams.push(`${e.name}…ぼくの…`);
    }
    return dreams.slice(0, 20);
  }, [entryByKey, layout.items, steps?.steps]);

  /** 置いてある窓（外が見える範囲。部屋の %） */
  const windowRects = useMemo(() => layout.items.filter((p) => p.key === fixtureKey("window")).map((p) => windowRectOf(p, style)), [layout.items, style]);
  /** 窓の外を通る犬（昼間、雨でない日。いちばん目の窓だけ。きょうたくさん歩いた日ほど、よく通る） */
  const firstWindowId = useMemo(() => layout.items.find((p) => p.key === fixtureKey("window"))?.id ?? null, [layout.items]);
  const passer = useWindowPasser({
    active: !editing && phase !== "night" && !(weather && ["rain", "drizzle", "thunder", "fog"].includes(weather.kind)),
    steps: visit ? null : steps?.steps,
    friends: visit ? [] : guests?.friends ?? [],
  });
  /** フロアランプの明かり（夜はそのまわりが明るい） */
  /** フロアランプのスイッチ（タップで切りかえ。さわっていなければ、暗くなると自動でつく） */
  const [lampSwitch, setLampSwitch] = useState<Record<string, boolean>>({});
  const lampIsOn = useCallback((id: string) => lampSwitch[id] ?? (lightsOn || furnitureFx[id] === "on"), [furnitureFx, lampSwitch, lightsOn]);
  /* ---------- 動きのある家具（レコードプレーヤー・扇風機・暖炉・鳥かご・ハムスター・ガチャ） ---------- */
  const monthJst = useMemo(() => Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric" }).format(now)), [now]);
  /** 暑い日は扇風機が自動でつく（気温がわからなければ7・8月） */
  const hot = weather?.temp != null ? weather.temp >= 26 : monthJst === 7 || monthJst === 8;
  /** 寒い季節は、わんこが暖炉の前で丸くなる */
  const winter = [12, 1, 2].includes(monthJst) || (weather?.temp != null && weather.temp <= 8);
  /** 夏（6〜9月）は暖炉の火を消して、キャンドルをともす */
  const fireSeason = monthJst < 6 || monthJst > 9;
  /** マントルピースのかざり（えらんでいなければ、11〜1月はくつした、ほかはキャンドル） */
  const mantelDefault = [11, 12, 1].includes(monthJst) ? "socks" : "candles";
  /** タップで切りかえたスイッチ（さわっていなければ、レコードは止まっていて、扇風機は暑い日につく） */
  const [recordSwitch, setRecordSwitch] = useState<Record<string, boolean>>({});
  const [fanSwitch, setFanSwitch] = useState<Record<string, boolean>>({});
  /** テレビを消しているもの（タップで切りかえ。ふだんはついている） */
  const [tvOff, setTvOff] = useState<Record<string, boolean>>({});
  const [mantel, setMantel] = useState<Record<string, string>>({});
  useEffect(() => {
    try { const raw = window.localStorage.getItem(MANTEL_KEY); if (raw) setMantel(JSON.parse(raw) as Record<string, string>); } catch { /* 読めなければ、くつした */ }
    try { const raw = window.localStorage.getItem(TV_KEY); if (raw) setTvOff(JSON.parse(raw) as Record<string, boolean>); } catch { /* 読めなければ、ついている */ }
  }, []);
  /** 家具ごとの、いまの状態（絵と、わんこの遊び方が変わる） */
  const furnitureMode = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of layout.items) {
      if (p.key === "furniture:record") m[p.id] = furnitureFx[p.id] === "on" || recordSwitch[p.id] ? "on" : "off";
      else if (p.key === "furniture:tv") m[p.id] = tvOff[p.id] ? "off" : "on";
      else if (p.key === "furniture:fan") m[p.id] = (fanSwitch[p.id] ?? hot) ? "on" : "off";
      else if (p.key === "furniture:fireplace") m[p.id] = `${fireSeason ? "fire" : "cold"}:${mantel[p.id] ?? mantelDefault}`;
    }
    return m;
  }, [fanSwitch, fireSeason, furnitureFx, hot, layout.items, mantel, mantelDefault, recordSwitch, tvOff]);
  /** 扇風機がついていれば、植物とカーテンが風でなびく */
  const breeze = !editing && layout.items.some((p) => p.key === "furniture:fan" && furnitureMode[p.id] === "on");
  /** しばらくのあいだだけ、家具を動かす（同じ動きのままなら、ms のあとでもとにもどす） */
  const fxFor = useCallback((id: string, fx: FurnitureFx, ms: number) => {
    onFurnitureFx(id, fx);
    window.setTimeout(() => setFurnitureFx((cur) => { if (cur[id] !== fx) return cur; const next = { ...cur }; delete next[id]; return next; }), ms);
  }, [onFurnitureFx]);
  /** インコがしゃべる（鳥かごの上に、ふきだし） */
  const birdLines = useMemo(() => ["オハヨー！", "ワン！ワン！", "カワイイネ", "オサンポ イク？", "ゴハン マダー？", "ピーチク パーチク♪", petName ? `${petName}！ ${petName}！` : "ワンチャン！"], [petName]);
  const birdTalk = useCallback((id: string, text?: string) => {
    const p = latest.current.items.find((it) => it.id === id);
    const el = roomRef.current?.querySelector<HTMLElement>(`[data-pid="${id}"]`);
    const r = el?.getBoundingClientRect(), room = roomRef.current?.getBoundingClientRect();
    if (!p || !r || !room) return;
    fxFor(id, "talk", 2400);
    // かごは絵の左よりにある（左右反転なら右より）
    const at = { x: ((r.left + r.width * (p.flip ? 0.55 : 0.45) - room.left) / room.width) * 100, y: ((r.top + r.height * 0.1 - room.top) / room.height) * 100 };
    setPeek({ id, text: `🦜 ${text ?? anyOf(birdLines)}`, bird: true, ...at });
    window.setTimeout(() => setPeek((cur) => (cur?.id === id ? null : cur)), 2600);
  }, [birdLines, fxFor]);
  const birdTalkRef = useRef(birdTalk);
  birdTalkRef.current = birdTalk;
  // インコは、ときどき ひとりでしゃべる（夜はねている）
  const birdIds = useMemo(() => layout.items.filter((p) => p.key === "furniture:birdcage").map((p) => p.id).join(","), [layout.items]);
  useEffect(() => {
    if (editing || sleepy || !birdIds) return;
    const ids = birdIds.split(",");
    let t = 0;
    const loop = () => { birdTalkRef.current(anyOf(ids)); t = window.setTimeout(loop, 16_000 + Math.random() * 14_000); };
    t = window.setTimeout(loop, 5000 + Math.random() * 6000);
    return () => window.clearTimeout(t);
  }, [birdIds, editing, sleepy]);
  /** ガチャのハンドルを回す（ときどき、カプセルがころんと出る） */
  const gachaTurn = useCallback((id: string) => {
    fxFor(id, "spin", 1300);
    window.setTimeout(() => {
      if (Math.random() < 0.45) {
        fxFor(id, "capsule", 25_000);
        flash(`カプセルから「${anyOf(GACHA_PRIZES)}」が でた！`);
        setDogCue({ id: Date.now(), text: "なになに？ みせて！", pose: "cheer" });
      } else flash("…からっぽ。もういっかい まわしてみて");
    }, 1200);
  }, [flash, fxFor]);

  const lampLights = useMemo(() => [
    ...layout.items
      .filter((p) => p.key === "furniture:lamp" && lampIsOn(p.id))
      .map((p) => ({ x: p.x, y: p.y - 15 * p.scale * depthScale(p.y), r: 20 * p.scale, base: p.y })),
    // 火のある暖炉も、まわりを明るくする
    ...(fireSeason ? layout.items
      .filter((p) => p.key === "furniture:fireplace")
      .map((p) => ({ x: p.x, y: p.y - 6 * p.scale * depthScale(p.y), r: 24 * p.scale, base: p.y })) : []),
  ], [fireSeason, lampIsOn, layout.items]);

  /** 犬が向かう場所（ベッド・ごはん皿・床のもの） */
  const dogPlaces = useMemo(() => {
    const floor = layout.items.filter((p) => { const e = entryByKey.get(p.key); return e && !isHanging(e.kind) && !p.on; });
    return {
      toys: floor.filter((p) => entryByKey.get(p.key)?.kind === "item").map((p) => ({ x: p.x, y: p.y, name: entryByKey.get(p.key)!.name })),
      // 飾ったおさんぽのおみやげ（床のものはそばへ、棚のものは下から見上げに行く）
      keepsakes: placedItems.flatMap((p) => {
        const e = entryByKey.get(p.key);
        if (e?.kind !== "souvenir") return [];
        return [{ id: p.id, x: p.x, y: p.on ? ROOM.floorTop + 2.5 : p.y, high: Boolean(p.on), act: SOUVENIR_ACTS[e.souvenir], name: souvenirName(e.souvenir, e.shiny) }];
      }),
      // 窓のまん中（犬が外をながめに行く）
      window: windowRects[0] ? { x: (windowRects[0].x0 + windowRects[0].x1) / 2 } : null,
      // 家具ひとつずつの場所と大きさ（犬がそれぞれの家具で遊ぶ）
      furniture: floor.flatMap((p) => {
        const e = entryByKey.get(p.key);
        if (!e || e.kind !== "furniture") return [];
        const w = widthOf(e, p, style);
        return [{ id: p.id, kind: e.furniture, x: p.x, y: p.y, w, h: (w * FURNITURE_RATIO[e.furniture]) / ROOM.aspect }];
      }),
      // 家具のあるところ（犬は家具の上を歩かず、ここをよけて回りこむ。ベッドとハウスだけは中へ入る）
      blocks: floor.flatMap((p) => {
        const e = entryByKey.get(p.key);
        if (!e || e.kind !== "furniture") return [];
        const w = widthOf(e, p, style);
        return [{ x0: p.x - w / 2 - 3, x1: p.x + w / 2 + 3, y0: p.y - (w * (FURNITURE_DEPTH[e.furniture] ?? 0.3)) / ROOM.aspect, y1: p.y + 3 }];
      }),
    };
  }, [entryByKey, layout.items, placedItems, style, windowRects]);

  /** るすばん中のいたずら（しばらく開かなかったあとは、床が散らかっている。自分の部屋だけ） */
  const { mess, fresh: freshMess, clean: cleanMess } = useRoomMess({ enabled: !visit, floorTop: ROOM.floorTop, floorBottom: ROOM.floorBottom, blocks: dogPlaces.blocks });
  useEffect(() => {
    if (!freshMess) return;
    flash("るすばん中に、わんこが なにか したみたい…");
    setDogCue({ id: Date.now(), text: "…しらないよ？", pose: "wonder" });
  }, [freshMess, flash]);
  const onCleanMess = (id: string) => {
    const left = mess.length - 1;
    cleanMess(id);
    setDogCue(left > 0 ? { id: Date.now(), text: ["…ごめんね", "えへへ…", "もう しないよ…たぶん"][Math.floor(Math.random() * 3)]!, pose: "bow" } : { id: Date.now(), text: "ぴかぴか！ かたづけて くれて ありがとう！", pose: "cheer" });
  };

  const selected = layout.items.find((p) => p.id === selectedId) ?? null;
  const selectedEntry = selected ? entryByKey.get(selected.key) ?? null : null;
  const counts = useMemo(() => {
    const c: Record<DecorKind, number> = { item: 0, photo: 0, trophy: 0, pennant: 0, furniture: 0, fixture: 0, souvenir: 0 };
    for (const e of allEntries) if (e.count > 0 || e.kind !== "souvenir") c[e.kind] += 1;
    return c;
  }, [allEntries]);
  const tabEntries = useMemo(() => allEntries.filter((e) => {
    if (tab === "theme" || e.kind !== tab) return false;
    if (e.kind === "souvenir") return e.count > 0;
    if (e.kind !== "item" || filter === "all") return true;
    if (filter === "sushi") return e.series === "sushi";
    return e.category === filter;
  }), [allEntries, filter, tab]);
  const saveLabel = saveState === "saving" ? "保存中…" : saveState === "dirty" ? "保存待ち" : saveState === "error" ? "保存できませんでした" : saveState === "local" ? "この端末に保存" : "保存ずみ";

  /* ---------- 記念撮影 ---------- */
  async function takeSnapshot() {
    const room = frameRef.current;
    if (!room || shooting) return;
    setShooting(true);
    setSelectedId(null);
    try {
      // パシャッ（白く光らせる）
      room.animate?.([{ filter: "brightness(1.8)" }, { filter: "brightness(1)" }], { duration: 380, easing: "ease-out" });
      const blob = await composeRoomSnapshot(room, {
        title: `${petName}のおへや`,
        sub: fmtDate(new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date())),
        fontFamily: getComputedStyle(document.body).fontFamily,
      });
      if (shot) URL.revokeObjectURL(shot.url);
      setShot({ blob, url: URL.createObjectURL(blob) });
      setShareBody(`${petName}のおへやを もようがえしたよ🏠`);
      setShareState("idle"); setShareError("");
    } catch {
      flash("写真をつくれませんでした");
    } finally {
      setShooting(false);
    }
  }
  async function saveSnapshot() {
    if (!shot) return;
    const file = new File([shot.blob], "wanko-room.jpg", { type: "image/jpeg" });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: `${petName}のおへや` }); return; }
    } catch { /* 共有をやめたとき */ return; }
    const a = document.createElement("a");
    a.href = shot.url; a.download = "wanko-room.jpg";
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function postSnapshot() {
    if (!shot || shareState === "sending") return;
    setShareState("sending"); setShareError("");
    try {
      const form = new FormData();
      form.append("image", shot.blob, "wanko-room.jpg");
      form.append("body", shareBody.trim().slice(0, 280));
      const response = await fetch("/api/my-room/share", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "投稿できませんでした。");
      setShareState("done");
    } catch (error) {
      setShareState("error");
      setShareError(error instanceof Error ? error.message : "投稿できませんでした。");
    }
  }
  const closeShot = () => { if (shot) URL.revokeObjectURL(shot.url); setShot(null); };

  /** ボード（またはカード）に映すもの：お天気カード → 使い方・記念撮影・ポスト */
  const stageContent = (
    <>
          <SkyCard
            now={now} place={place} onPlace={changePlace} weather={weather} steps={steps} history={stepHistory}
            // ボードの面の高さいっぱい
            height="max(150px, 100%)"
            friends={guests?.friends}
            likes={guests?.mail.filter((m) => m.kind === "like").length ?? 0}
            onEdit={() => setEditing(true)}
          />
          <ul className="space-y-1.5 rounded-2xl border border-line bg-card px-4 py-3 text-[12px] leading-relaxed text-ink-soft shadow-sm">
            <li>🐾 {petName}をタップすると、なでられます</li>
            <li>🖼️ 飾った写真をタップすると、その日の思い出が見られます</li>
            <li>🕰️ 窓の外・部屋の明るさ・時計は、住んでいるところ（📍で変えられます）の、いまの時刻・天気と、季節の日の出・日の入りに合わせて変わります</li>
            <li>🚩 おでかけを記録した都道府県のペナントや、おさんぽのトロフィーも飾れます</li>
          </ul>
          {/* 黒板の中は左右に余白をとるので、ボタンは包んでから幅いっぱいにする（はみ出して横にずれないように） */}
          <div>
            <button type="button" onClick={() => void takeSnapshot()} disabled={shooting} className="flex w-full items-center justify-center gap-2 rounded-full bg-leaf-deep py-3 text-sm font-black text-white shadow-md active:scale-[.98] disabled:opacity-60">
              <span aria-hidden="true">📷</span>{shooting ? "撮影中…" : "記念撮影する"}
            </button>
          </div>
          {guests ? <RoomGuests mail={guests.mail} /> : null}
          <p className="pb-1 text-center text-[10px] font-semibold text-ink-faint">{saveLabel}</p>
    </>
  );
  /** 部屋の下のまわりの色（部屋の床の色 → 空の色）。部屋の下のはしもこの色にとかす */
  const backdrop = skyBackdrop(skyNow, FLOOR_STYLES[layout.theme.floor].base);

  return (
    // ふだん（自分の部屋を見ているとき）は、画面ぴったり：部屋 → 部屋の下の黒板（黒板の中だけスクロール）
    <DoodleContext.Provider value={doodleInfo}>
    <PlantContext.Provider value={visit ? null : plant}>
      <main className={stage ? "fixed inset-0 flex flex-col overflow-y-auto overflow-x-hidden bg-paper text-ink" : "min-h-dvh bg-paper pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-ink"}>
        <header className="sticky top-0 z-[600] shrink-0 border-b border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-3">
            <Link href={visit ? "/room" : "/home"} aria-label={visit ? "じぶんのおへやへ戻る" : "ホームへ戻る"} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-paper-deep">
              <IconChevronLeft size={24} />
            </Link>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-[10px] font-bold tracking-[0.18em] text-leaf-deep">{visit ? "FRIEND'S ROOM" : "MY ROOM"}</p>
              <h1 className="truncate text-[17px] font-black">{visit ? `${visit.name}さんのおへや` : `${petName}のおへや`}</h1>
            </div>
            {/* もっている青コイン（タップで家具のお店へ） */}
            {!visit && shopState?.ready ? (
              <button
                type="button"
                onClick={() => { setEditing(true); setTab("furniture"); }}
                aria-label={`青コイン ${shopState.blueCoins.toLocaleString()}枚（家具のお店へ）`}
                className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-[#BFD7F5] bg-[#EEF5FF] pl-1.5 pr-2.5 text-[12px] font-black tabular-nums text-[#1F4F8F] shadow-sm active:scale-95"
              >
                <BlueCoinArt className="h-5 w-5" />
                {shopState.blueCoins.toLocaleString()}
              </button>
            ) : null}
            {visit ? (
              <LikeButton liked={visitLike.liked} count={visitLike.likeCount} busy={visitLike.busy} onToggle={() => void visitLike.toggleLike()} />
            ) : editing ? (
              <button type="button" onClick={() => { setEditing(false); setSelectedId(null); if (saveState === "dirty") void persist(); }} className="min-w-[72px] rounded-full bg-leaf-deep px-4 py-2.5 text-sm font-bold text-white shadow-sm active:scale-95">
                できた
              </button>
            ) : (
              <button type="button" onClick={() => setEditing(true)} className="min-w-[72px] rounded-full border border-leaf/40 bg-leaf-soft px-3 py-2.5 text-xs font-bold text-leaf-deep shadow-sm active:scale-95">
                もようがえ
              </button>
            )}
          </div>
        </header>

        <div className={stage ? "mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col" : "mx-auto max-w-lg"}>
          <div
            ref={frameRef}
            className={`isolate w-full shrink-0 touch-none select-none overflow-hidden ${editing ? "sticky top-14 z-[50] shadow-[0_8px_16px_-10px_rgba(60,40,20,.35)]" : "relative"}`}
            style={{ aspectRatio: `1000 / ${1000 * ROOM.aspect}` }}
            onPointerDown={(e) => { if (e.target === e.currentTarget || e.target === roomRef.current || (e.target as Element).tagName === "svg" || (e.target as Element).closest("svg[aria-hidden]")) setSelectedId(null); }}
          >
            {/* 部屋（奥の壁から手前の床まで）。まわりの天井・横の壁・手前の床は背景の SVG がはみ出して描く */}
            <div ref={roomRef} className="absolute" style={{ left: `${ROOM_STAGE.left}%`, top: `${ROOM_STAGE.top}%`, width: `${ROOM_STAGE.width}%`, height: `${ROOM_STAGE.height}%` }}>
            <RoomScene theme={layout.theme} now={now} at={place} weather={weather} windows={windowRects} />

            {placedItems.map((p) => {
              const entry = entryByKey.get(p.key);
              if (!entry) return null;
              const hang = isHanging(entry.kind);
              const fx = entry.kind === "fixture" ? fixtureSize(entry.fixture, style) : null;
              const isSel = editing && p.id === selectedId;
              return (
                <div
                  key={p.id}
                  data-pid={p.id}
                  data-rot={entry.kind === "pennant" ? -4 : 0}
                  data-flip={p.flip ? "1" : "0"}
                  role="button"
                  tabIndex={0}
                  aria-label={editing ? `${entry.name}を動かす` : entry.kind === "photo" ? `${entry.name}の思い出を見る` : entry.name}
                  className={`absolute ${editing ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: `${widthOf(entry, p, style)}%`,
                    zIndex: zIndexOf.get(p.id),
                    transform: fx ? `translate(${-fx.ax * 100}%, ${-fx.ay * 100}%)` : `translate(-50%, ${hang ? "-50%" : "-100%"}) ${entry.kind === "pennant" ? "rotate(-4deg)" : ""}`,
                    touchAction: "none",
                  }}
                  onPointerDown={(e) => onItemDown(e, p)}
                  onPointerMove={(e) => onItemMove(e, p)}
                  onPointerUp={(e) => onItemUp(e, p)}
                  onPointerCancel={(e) => onItemUp(e, p)}
                  onClick={(e) => onItemTap(p, e.currentTarget)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (editing) setSelectedId(p.id); else onItemTap(p); } }}
                >
                  {!hang && !p.on ? <span data-shadow className="pointer-events-none absolute -bottom-[4%] left-1/2 h-[10%] w-[78%] -translate-x-1/2 rounded-[50%] bg-[#4a3520]/18 blur-[2px]" /> : null}
                  {/* 棚の上：板に落ちる小さな影 */}
                  {!hang && p.on ? <span data-shadow className="pointer-events-none absolute -bottom-[3%] left-1/2 h-[7%] w-[84%] -translate-x-1/2 rounded-[50%] bg-[#3a2410]/30 blur-[1.5px]" /> : null}
                  <span data-body className="relative block" style={{ transform: p.flip ? "scaleX(-1)" : undefined }}>
                    <span key={furnitureFx[p.id] ?? "-"} className={`block origin-bottom ${FX_CLASS[furnitureFx[p.id]!] ?? (breeze && p.key === "furniture:plant" ? "room-breeze-plant" : breeze && p.key === fixtureKey("window") ? "room-breeze" : "")}`}>
                      {entry.kind === "fixture"
                        ? <FixtureVisual fixture={entry.fixture} theme={layout.theme} now={now} at={place} weather={weather} placeName={placeName} passer={p.id === firstWindowId ? passer : null} grime={dirt} />
                        : <DecorVisual entry={entry} frame={p.frame} lit={p.key === "furniture:lamp" ? lampIsOn(p.id) : lightsOn || furnitureFx[p.id] === "on"} fx={furnitureFx[p.id]} mode={furnitureMode[p.id]} />}
                    </span>
                  </span>
                  {dropShelf === p.id ? <span className="pointer-events-none absolute -inset-1 rounded-xl border-2 border-dashed border-leaf bg-leaf/15 shadow-[0_0_14px_rgba(140,200,110,.8)]" /> : null}
                  {isSel ? (
                    <span className="room-selected pointer-events-none absolute -inset-2 rounded-xl border-2 border-white/90 shadow-[0_0_0_2px_rgba(94,140,74,.9),0_0_16px_rgba(140,200,110,.75)]">
                      {["-left-1.5 -top-1.5", "-right-1.5 -top-1.5", "-bottom-1.5 -left-1.5", "-bottom-1.5 -right-1.5"].map((pos) => <span key={pos} className={`absolute h-3 w-3 rounded-full border-2 border-white bg-leaf-deep shadow ${pos}`} />)}
                    </span>
                  ) : null}

                </div>
              );
            })}

            {!editing && mess.length ? <RoomMess mess={mess} onClean={(m) => onCleanMess(m.id)} /> : null}
          <RoomDog skin={dogSkin} phase={phase} sleepy={sleepy} lines={dogLines} dreams={dogDreams} cue={dogCue} call={dogCall} carry={carrying ? <SouvenirArt id={carrying.id} shiny={carrying.shiny} /> : null} introduce={visit ? petName : null} quiet={editing} places={dogPlaces} weather={weather?.kind ?? null} onFx={onFurnitureFx} modes={furnitureMode} winter={winter} hot={hot} onFurnitureSay={birdTalk} />
          {/* 遊びに来たフレンドのわんこ。自分のわんこと同じように暮らし、少し横にずれて並ぶ（家具は動かさない） */}
          {guest ? <RoomDog key={guest.id} skin={guest.skin} phase={phase} sleepy={sleepy} lines={guestLines} dreams={GUEST_DREAMS} call={guestCall} quiet={editing} places={dogPlaces} weather={weather?.kind ?? null} modes={furnitureMode} winter={winter} hot={hot} offset={9} onTap={setGuestCard} label="遊びに来たフレンドの犬" /> : null}
            {/* 行事のもの（部屋の左右のすみ）。置いたものと同じく、奥ほど下に重なる */}
            {roomEvent ? (["L", "R"] as const).map((side) => (
              <div key={side} className="pointer-events-none absolute inset-0" style={{ zIndex: 300 + Math.round(EVENT_FLOOR_Y[side] * 10) }} data-event-layer>
                <EventFloor event={roomEvent} side={side} lit={lightsOn} />
              </div>
            )) : null}
            {roomEvent ? (
              <div className="pointer-events-none absolute inset-0" style={{ zIndex: 1990 }}>
                <EventFront event={roomEvent} lit={lightsOn} />
              </div>
            ) : null}
            {/* 晴れた夜は、ときどき窓の外を流れ星が流れる（タップでねがいごと） */}
            {/* フレンドの犬が通っているときは、窓をタップするとその部屋へ */}
            <PasserLink rects={windowRects} passer={passer} />
            {/* ほこり・クモの巣（おさんぽをさぼると） */}
            {!editing ? <RoomDust dirt={dirt} onTap={dirtHint} /> : null}
            {/* 遊びに来た（おとまりの）フレンドのわんこの名ふだ */}
            {guest && guestCard ? <DogNameCard dogName={guest.dogName} owner={guest.name} href={`/room/visit/${guest.id}`} x={clamp(guestCard.x, 18, 82)} y={Math.max(8, guestCard.y - 16)} /> : null}
            <ShootingStars rects={windowRects} active={phase === "night" && !editing && (!weather || weather.kind === "clear" || weather.kind === "partly")} onWish={flash} />
            <div className="pointer-events-none absolute inset-0" style={{ zIndex: 2000 }}>
              <RoomLighting now={now} lamps={lampLights} at={place} weather={weather} room={layout.theme.room} event={roomEvent} openBottom={stage} />
            </div>
            {peek ? (
              <span className={`room-bubble pointer-events-none absolute w-max max-w-[12rem] -translate-x-1/2 -translate-y-full rounded-xl px-2.5 py-1 text-[10px] font-bold shadow ${peek.bird ? "border-2 border-[#7CC63A] bg-[#FBFFF3] text-[#2E5A1E]" : "bg-ink text-white"}`} style={{ left: `${clamp(peek.x, 18, 82)}%`, top: `${Math.max(4, peek.y - 0.5)}%`, zIndex: 2600 }}>{peek.text}</span>
            ) : null}
            </div>

            {/* 部屋の下のはしを、下のまわりの色にとかす（境目をなじませる） */}
            {stage ? <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[8%]" style={{ zIndex: 2400, background: `linear-gradient(180deg, transparent, ${backdrop.top})` }} /> : null}
            {editing && selected && selectedEntry ? (
              <div className="absolute bottom-2 left-1/2 z-[3000] flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-card/95 p-1.5 shadow-lg backdrop-blur">
                <Tool label="小さく" onClick={() => changeItem(selected.id, (p) => ({ ...p, scale: clamp(p.scale - 0.12, 0.5, 2) }))}>−</Tool>
                <Tool label="大きく" onClick={() => changeItem(selected.id, (p) => ({ ...p, scale: clamp(p.scale + 0.12, 0.5, 2) }))}>＋</Tool>
                <Tool label="左右反転" onClick={() => changeItem(selected.id, (p) => ({ ...p, flip: !p.flip }))}>↔</Tool>
                <Tool label="いちばん前へ" onClick={() => changeItem(selected.id, (p) => ({ ...p, z: topZ() }))}>⇡</Tool>
                {selectedEntry.kind === "item" || selectedEntry.kind === "trophy" || selectedEntry.kind === "souvenir" ? (
                  selected.on ? (
                    <Tool label="床におろす" onClick={() => { changeItem(selected.id, (p) => { const { on: _on, rx: _rx, ...rest } = p; return { ...rest, y: clamp(ROOM.floorTop + 14, ROOM.floorTop, ROOM.floorBottom) }; }); flash("床におろしました"); }}>
                      <span className="text-[10px] font-black leading-none">床へ</span>
                    </Tool>
                  ) : shelfList.length ? (
                    <Tool label="棚にのせる" onClick={() => {
                      // 乗せているものがいちばん少ない棚の、あいているところへ
                      const load = (sh: Placement) => layout.items.filter((p) => p.on === sh.id).length;
                      const shelf = shelfList.reduce((a, b) => (load(b) < load(a) ? b : a));
                      changeItem(selected.id, (p) => ({ ...p, on: shelf.id, rx: freeShelfSpot(shelf.id, layout.items), x: shelf.x, y: shelf.y }));
                      flash("棚にのせました");
                    }}>
                      <span className="text-[10px] font-black leading-none">棚へ</span>
                    </Tool>
                  ) : null
                ) : null}
                {selectedEntry.kind === "photo" ? (
                  <Tool label="額縁を変える" onClick={() => changeItem(selected.id, (p) => ({ ...p, frame: FRAME_STYLES[(FRAME_STYLES.indexOf(p.frame ?? "wood") + 1) % FRAME_STYLES.length] }))}>
                    <span className="text-[10px] font-black">{FRAME_LABELS[selected.frame ?? "wood"]}</span>
                  </Tool>
                ) : null}
                {selectedEntry.kind === "photo" && selectedEntry.upload ? (
                  <Tool label="写真のなまえ" onClick={() => renameUpload(selectedEntry.key.slice("upload:".length))}>✎</Tool>
                ) : null}
                <Tool danger label="片づける" onClick={() => {
                  const riding = layout.items.filter((p) => p.on === selected.id).length;
                  commit({ ...layout, items: layout.items.filter((p) => p.id !== selected.id && p.on !== selected.id) });
                  setSelectedId(null);
                  if (riding) flash(`棚に乗せていた${riding}こも、いっしょにしまいました`);
                }}>🗑</Tool>
              </div>
            ) : null}
          </div>

          {editing ? (
            <>
              <div className="grid grid-cols-3 gap-2 border-y border-line bg-paper-deep px-4 py-2">
                <Action disabled={!past.length} onClick={undo} label="↶ 元に戻す" />
                <Action disabled={!future.length} onClick={redo} label="↷ やり直す" />
                <Action disabled={!layout.items.some((p) => !p.key.startsWith("fixture:"))} onClick={() => { commit({ ...layout, items: layout.items.filter((p) => p.key.startsWith("fixture:")).map((p) => p) }); setSelectedId(null); }} label="ぜんぶ片づける" />
              </div>
              <section className="rounded-t-[26px] bg-card px-4 pb-6 pt-3 shadow-[0_-8px_24px_rgba(93,80,58,.08)]">
                <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="tablist" aria-label="飾るもの">
                  {TABS.map((t) => (
                    <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`shrink-0 rounded-xl px-3 py-2 text-[13px] font-black ${tab === t.id ? "bg-leaf-deep text-white" : "bg-paper-deep text-ink-soft"}`}>
                      {t.label}{t.id !== "theme" ? <span className="ml-1 text-[10px] font-bold opacity-75">{counts[t.id]}</span> : null}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] font-semibold text-ink-faint">
                  {tab === "theme" ? "おへやの雰囲気・窓・壁紙・床・カーテン・ラグを選べます" : tab === "photo" ? "スマホの写真や、おでかけ記録の写真を額に入れて飾れます" : tab === "fixture" ? "窓・棚・時計も、動かす・大きさを変える・しまうができます" : tab === "souvenir" ? "タップで飾る・ドラッグで動かす（棚へドラッグするか「棚へ」で棚に乗せられます）" : "タップで飾る・ドラッグで動かす（アイテムやトロフィーは、棚へドラッグするか「棚へ」で棚に乗せられます）"}
                </p>
                {tab === "item" ? (
                  <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
                    {ITEM_FILTERS.map((f) => (
                      <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${filter === f.id ? "border-leaf bg-leaf-soft text-leaf-deep" : "border-line bg-paper text-ink-soft"}`}>{f.label}</button>
                    ))}
                  </div>
                ) : null}
                {tab === "photo" ? (
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); }} />
                ) : null}
                {tab === "souvenir" ? (
                  <SouvenirBook
                    owned={layout.souvenirs ?? {}}
                    now={now}
                    placedOf={(id, shiny) => layout.items.filter((p) => p.key === souvenirKey(id, shiny)).length}
                    onPlace={(id, shiny) => { const e = entryByKey.get(souvenirKey(id, shiny)); if (e) addEntry(e); }}
                  />
                ) : tab === "theme" ? (
                  <ThemePicker
                    theme={layout.theme} onChange={setTheme} now={now} shop={shopState}
                    onBought={(id, owned, balance) => {
                      setShopState((cur) => {
                        if (!cur) return cur;
                        // おへやを買うと、合う壁紙・床・窓などもセットでもらえる
                        const bundle = isThemeGoodId(id) && themeGood(id).part === "room" ? roomBundle(themeGood(id).value as RoomKind) : [];
                        return { ...cur, blueCoins: balance, owned: { ...cur.owned, [id]: owned, ...Object.fromEntries(bundle.map((b) => [b, 1])) } };
                      });
                      flash(`${shopName(id)}を買いました！`);
                    }}
                    dogName={petName}
                    onDogName={(name) => { const n = cleanDogName(name); commit({ ...latest.current, ...(n ? { dogName: n } : { dogName: undefined }) }); flash(n ? `わんこの名前を「${n}」にしました` : "名前を「わんこ」にもどしました"); }}
                  />
                ) : (tab === "furniture" || tab === "fixture") && shopState?.ready ? (
                  <FurnitureShop
                    key={tab}
                    ids={tab === "furniture" ? FURNITURE_IDS : FIXTURE_IDS}
                    what={tab === "furniture" ? "家具" : "窓・棚"}
                    shop={shopState}
                    placedOf={(key) => layout.items.filter((p) => p.key === key).length}
                    onPlace={(e) => addEntry(e)}
                    onBought={(id, owned, balance) => { setShopState((cur) => (cur ? { ...cur, blueCoins: balance, owned: { ...cur.owned, [id]: owned } } : cur)); flash(`${shopName(id)}を買いました！`); }}
                    thumb={(e) => (e.kind === "fixture" ? <FixtureVisual fixture={e.fixture} theme={layout.theme} now={now} at={place} weather={weather} placeName={placeName} /> : <DecorVisual entry={e} thumb />)}
                  />
                ) : tabEntries.length || tab === "photo" ? (
                  <div className="mt-2 grid grid-cols-3 gap-2.5">
                    {tab === "photo" ? (
                      <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-leaf/50 bg-leaf-soft/40 p-2 text-center text-leaf-deep shadow-sm active:scale-[.97] disabled:opacity-60">
                        <span className="text-2xl leading-none">{uploading ? "⏳" : "＋"}</span>
                        <span className="text-[11px] font-black">{uploading ? "アップロード中…" : "写真をえらぶ"}</span>
                        <span className="text-[9px] font-bold text-ink-faint">{layout.photos.length}/{ROOM_MAX_PHOTOS}枚</span>
                      </button>
                    ) : null}
                    {tabEntries.map((e) => {
                      const placed = layout.items.filter((p) => p.key === e.key).length;
                      return (
                        <button key={e.key} type="button" onClick={() => addEntry(e)} className={`relative min-w-0 rounded-2xl border bg-paper p-2 text-left shadow-sm transition active:scale-[.97] ${placed ? "border-leaf/60" : "border-line"}`}>
                          {e.kind === "item" ? <span className={`absolute left-1.5 top-1.5 z-10 rounded-full px-1.5 py-0.5 text-[9px] font-black text-white ${RARITY_STYLE[e.rarity]}`}>{e.rarity}</span> : null}
                          <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-card/90 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-ink-soft">{placed}/{e.count}</span>
                          <span className="flex aspect-square items-center justify-center pt-3">
                            <span className="block w-[78%]">{e.kind === "fixture" ? <FixtureVisual fixture={e.fixture} theme={layout.theme} now={now} at={place} weather={weather} placeName={placeName} /> : <DecorVisual entry={e} thumb />}</span>
                          </span>
                          <span className="mt-1 block truncate text-center text-[10px] font-bold">{e.name}</span>
                          {e.kind === "photo" && e.upload ? (
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={`${e.name}を消す`}
                              onClick={(ev) => { ev.stopPropagation(); const ph = layout.photos.find((x) => uploadKey(x.id) === e.key); if (ph) removeUpload(ph); }}
                              onKeyDown={(ev) => { if (ev.key === "Enter") { ev.stopPropagation(); const ph = layout.photos.find((x) => uploadKey(x.id) === e.key); if (ph) removeUpload(ph); } }}
                              className="absolute bottom-1 right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-blossom-soft text-[11px] font-black text-[#b94c60] shadow-sm"
                            >×</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="my-6 rounded-2xl border border-dashed border-line-strong bg-paper px-4 py-8 text-center text-sm text-ink-soft">{TABS.find((t) => t.id === tab)?.empty}</div>
                )}
              </section>
            </>
          ) : visit ? (
            <VisitPanel visit={visit} dogName="わんこ" liked={visitLike.liked} likeCount={visitLike.likeCount} likeBusy={visitLike.busy} onLike={() => void visitLike.toggleLike()} />
          ) : (
            // 小さい画面でもつぶれないよう、最低の高さをとる（そのときだけ画面が少しスクロールする）
            <div ref={stageRef} className="relative z-10 -mt-px min-h-[300px] flex-1" style={{ background: `linear-gradient(180deg, ${backdrop.top} 0%, ${backdrop.mid} 42%, ${backdrop.mid} 100%)` }}>
              {/* 木のわくの黒板（お天気カードをマグネットでとめる）。位置と大きさは決まっていて、中はたてにだけスクロールする */}
              <div className="absolute inset-x-1 top-3 bottom-[calc(env(safe-area-inset-bottom)+10px)]">
                <RoomBoard dark={1 - skyNow.light}>
                  {stageContent}
                </RoomBoard>
              </div>
            </div>
          )}
        </div>

        {shot ? (
          <div className="fixed inset-0 z-[700] flex items-center justify-center overflow-y-auto bg-[#140f22]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="記念撮影" onClick={(e) => { if (e.target === e.currentTarget) closeShot(); }}>
            <div className="room-bubble my-auto w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.url} alt="おへやの記念写真" className="block w-full" />
              <div className="space-y-2.5 px-4 pb-4 pt-3">
                <button type="button" onClick={() => void saveSnapshot()} className="w-full rounded-full bg-leaf-deep py-2.5 text-sm font-black text-white active:scale-[.98]">画像を保存・共有する</button>
                {shareState === "done" ? (
                  <p className="rounded-2xl bg-leaf-soft px-3 py-2.5 text-center text-xs font-bold text-leaf-deep">SNSに投稿しました！ <Link href="/sns/home" className="underline">SNSで見る</Link></p>
                ) : (
                  <div className="space-y-2 rounded-2xl border border-line bg-paper p-2.5">
                    <textarea value={shareBody} onChange={(e) => setShareBody(e.target.value)} maxLength={280} rows={2} aria-label="投稿する文" className="w-full resize-none rounded-xl border border-line bg-card px-3 py-2 text-[16px] leading-snug" />
                    {shareError ? <p className="text-center text-[11px] font-bold text-[#b94c60]">{shareError}</p> : null}
                    <button type="button" onClick={() => void postSnapshot()} disabled={shareState === "sending"} className="w-full rounded-full bg-[#ff7eb6] py-2.5 text-sm font-black text-white active:scale-[.98] disabled:opacity-60">{shareState === "sending" ? "投稿中…" : "SNSに投稿する"}</button>
                  </div>
                )}
                <button type="button" onClick={closeShot} className="w-full rounded-full border border-line bg-paper py-2.5 text-sm font-bold text-ink-soft active:scale-[.98]">とじる</button>
              </div>
            </div>
          </div>
        ) : null}

        {diary ? <DiaryDialog history={stepHistory ?? []} today={todayKey} dogName={petName} onClose={() => setDiary(false)} /> : null}

        {lightbox ? (
          <div className="fixed inset-0 z-[700] flex items-center justify-center bg-[#140f22]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${lightbox.name}の思い出`} onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}>
            <div className="room-bubble w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightbox.full} alt={lightbox.name} className="block max-h-[58vh] w-full bg-paper-deep object-contain" />
              <div className="space-y-1 px-4 pb-4 pt-3">
                <p className="text-base font-black">{lightbox.name}</p>
                <p className="text-xs font-semibold text-ink-faint">{lightbox.upload ? `${fmtDate(lightbox.date)}に飾った写真` : [lightbox.pref, fmtDate(lightbox.date)].filter(Boolean).join(" ・ ")}</p>
                {lightbox.comment ? <p className="whitespace-pre-wrap pt-1 text-[13px] leading-relaxed text-ink-soft">{lightbox.comment}</p> : null}
                <button type="button" onClick={() => setLightbox(null)} className="mt-3 w-full rounded-full border border-line bg-paper py-2.5 text-sm font-bold text-ink-soft active:scale-[.98]">とじる</button>
              </div>
            </div>
          </div>
        ) : null}

        {souvenirNews && !editing ? (
          <SouvenirGift news={souvenirNews} dogName={petName} onClose={() => setSouvenirNews(null)} onDecorate={() => { setSouvenirNews(null); setEditing(true); setTab("souvenir"); }} />
        ) : null}
        {toast ? <div className="fixed bottom-6 left-1/2 z-[800] -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-xs font-bold text-white shadow-lg">{toast}</div> : null}
      </main>
    </PlantContext.Provider>
    </DoodleContext.Provider>
  );
}

const STYLE_LABELS: Record<RoomStyle, string> = { standard: "いつもの", arch: "アーチ窓", bay: "出窓", round: "まる窓", attic: "屋根裏", shoji: "和室", french: "大きな窓" };
/** 部屋の形の見本（壁と窓のかたち） */
const styleSwatch = (style: RoomStyle): React.CSSProperties => {
  const shape: Record<RoomStyle, string> = {
    standard: "<rect x='9' y='9' width='30' height='24' fill='%2398CDF0' stroke='%23fff' stroke-width='3'/><path d='M24 9v24M9 21h30' stroke='%23fff' stroke-width='2'/>",
    arch: "<path d='M13 38V20a11 11 0 0 1 22 0v18z' fill='%2398CDF0' stroke='%23fff' stroke-width='3'/><path d='M24 9v29M13 22h22' stroke='%23fff' stroke-width='2'/>",
    bay: "<path d='M6 12h36v22H6z' fill='%2398CDF0' stroke='%23fff' stroke-width='3'/><path d='M14 13v20M34 13v20' stroke='%23fff' stroke-width='2'/><rect x='3' y='34' width='42' height='5' fill='%23fff'/>",
    round: "<circle cx='24' cy='22' r='12' fill='%2398CDF0' stroke='%23A8743F' stroke-width='4'/><path d='M24 10v24M12 22h24' stroke='%23A8743F' stroke-width='2'/>",
    attic: "<path d='M0 0h12L0 18zM48 0H36l12 18z' fill='%23D9B98E'/><path d='M15 38V20l9-8 9 8v18z' fill='%2398CDF0' stroke='%23fff' stroke-width='3'/>",
    shoji: "<rect x='8' y='9' width='32' height='28' fill='%23FFFBEF' stroke='%236E4424' stroke-width='3'/><rect x='8' y='9' width='16' height='28' fill='%2398CDF0' stroke='%236E4424' stroke-width='3'/><path d='M30 9v28M35 9v28M24 18h16M24 27h16' stroke='%238A5A34' stroke-width='1.5'/>",
    french: "<rect x='12' y='6' width='24' height='38' fill='%2398CDF0' stroke='%23fff' stroke-width='3'/><path d='M24 6v38' stroke='%23fff' stroke-width='2'/><path d='M12 33h24' stroke='%23F4F1EA' stroke-width='3'/>",
  };
  return { background: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><rect width='48' height='48' fill='%23FBF3E4'/>${shape[style]}</svg>") center/cover` };
};
const DECO_LABELS: Record<WallDeco, string> = { none: "なし", garland: "ガーランド", lights: "ライト", stars: "お星さま" };

function ThemePicker({ theme, onChange, now, shop, onBought, dogName, onDogName }: {
  theme: RoomTheme; onChange: (patch: Partial<RoomTheme>) => void; now: Date;
  /** 青コインのお店（無ければ、どのデザインも自由に選べる） */
  shop: RoomShop | null;
  onBought: (id: ShopId, owned: number, balance: number) => void;
  /** わんこの名前（部屋に保存する） */
  dogName: string;
  onDogName: (name: string) => void;
}) {
  const event = roomEventOf(now), next = nextRoomEvent(now);
  const eventsOn = theme.events !== false;
  const [buying, setBuying] = useState<{ id: ThemeGoodId; apply: () => void; thumb: React.ReactNode } | null>(null);
  const [nameDraft, setNameDraft] = useState(dogName);
  /** 持っていないデザイン（買うときの値段） */
  const lockOf = <P extends ThemePart>(part: P) => (id: RoomTheme[P]) => (shop?.ready && !isFreeTheme(part, id) && !shop.owned[themeGoodId(part, id)] ? THEME_PRICES[part] : null);
  /** えらぶ。持っていなければ、買ってからえらぶ */
  const pick = <P extends ThemePart>(part: P, thumb: (id: RoomTheme[P]) => React.ReactNode, apply: (id: RoomTheme[P]) => void) => (id: RoomTheme[P]) => {
    if (lockOf(part)(id) !== null) setBuying({ id: themeGoodId(part, id), apply: () => apply(id), thumb: thumb(id) });
    else apply(id);
  };
  const roomThumb = (room: RoomKind) => <ThemeSwatch part="room" theme={ROOM_PRESETS[room]} />;
  const swatch = <P extends Exclude<ThemePart, "room" | "style">>(part: P) => function Swatch(v: RoomTheme[P]) { return <ThemeSwatch part={part} theme={{ ...theme, [part]: v }} />; };
  return (
    <div className="mt-3 space-y-4">
      {/* わんこの名前 */}
      <div className="rounded-2xl border border-line bg-paper px-3 py-2.5">
        <p className="text-xs font-black text-ink-soft">わんこの なまえ</p>
        <form className="mt-1.5 flex gap-2" onSubmit={(e) => { e.preventDefault(); onDogName(nameDraft); }}>
          <input value={nameDraft} onChange={(e) => setNameDraft([...e.target.value].slice(0, DOG_NAME_MAX).join(""))} placeholder="わんこ" aria-label="わんこの名前"
            className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 text-[16px] font-bold" />
          <button type="submit" disabled={nameDraft.trim() === dogName} className="shrink-0 rounded-full bg-leaf-deep px-4 text-sm font-black text-white disabled:opacity-40">きめる</button>
        </form>
        <p className="mt-1 text-[10px] font-bold text-ink-faint">フレンドの部屋にあそびに行ったときは、タップされたときだけ名前が出ます</p>
      </div>
      {shop?.ready ? <BlueCoinBar shop={shop} note="🔒のデザインは青コインで買えます。おへやは、合う壁紙・床・窓などもセットです。" /> : null}
      <Swatches title="おへや（えらぶと壁・床・窓もおすすめに変わります）" value={theme.room} options={ROOM_KINDS} label={(id) => ROOM_KIND_STYLES[id].label} render={roomThumb} lock={lockOf("room")} onPick={pick("room", roomThumb, (room) => onChange({ ...ROOM_PRESETS[room] }))} />
      <Swatches title="窓" value={theme.style} options={ROOM_STYLES} label={(id) => STYLE_LABELS[id]} paint={styleSwatch} lock={lockOf("style")} onPick={pick("style", (id) => <span className="block h-14 w-14" style={styleSwatch(id)} />, (style) => onChange({ style }))} />
      <Swatches title="壁紙" value={theme.wall} options={WALLPAPERS} label={(id) => WALLPAPER_STYLES[id].label} render={swatch("wall")} lock={lockOf("wall")} onPick={pick("wall", swatch("wall"), (wall) => onChange({ wall }))} />
      <Swatches title="床" value={theme.floor} options={FLOORS} label={(id) => FLOOR_STYLES[id].label} render={swatch("floor")} lock={lockOf("floor")} onPick={pick("floor", swatch("floor"), (floor) => onChange({ floor }))} />
      <Swatches title="カーテン" value={theme.curtain} options={CURTAINS} label={(id) => CURTAIN_STYLES[id].label} render={swatch("curtain")} lock={lockOf("curtain")} onPick={pick("curtain", swatch("curtain"), (curtain) => onChange({ curtain }))} />
      <Swatches title="壁のかざり" value={theme.deco} options={WALL_DECOS} label={(id) => DECO_LABELS[id]} render={swatch("deco")} lock={lockOf("deco")} onPick={pick("deco", swatch("deco"), (deco) => onChange({ deco }))} />
      <Swatches title="ラグ" value={theme.rug} options={RUGS} label={(id) => RUG_STYLES[id].label} render={swatch("rug")} lock={lockOf("rug")} onPick={pick("rug", swatch("rug"), (rug) => onChange({ rug }))} />
      {buying && shop ? (
        <BuyDialog
          id={buying.id} blueCoins={shop.blueCoins} thumb={buying.thumb} actionLabel="買ってえらぶ"
          onClose={() => setBuying(null)}
          onDone={(owned, balance) => { onBought(buying.id, owned, balance); buying.apply(); setBuying(null); }}
        />
      ) : null}
      {/* 季節の行事かざり */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-black text-ink-soft">季節の行事かざり</p>
          <p className="mt-0.5 text-[10px] font-bold text-ink-faint">
            {event ? `いまは「${event.name}」（${event.from[0]}/${event.from[1]}〜${event.to[0]}/${event.to[1]}）` : `つぎは「${next.name}」 ${next.from[0]}/${next.from[1]}から`}・お正月・ひなまつり・七夕・ハロウィン・クリスマスなど
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={eventsOn}
          aria-label="季節の行事かざり"
          onClick={() => onChange({ events: !eventsOn })}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${eventsOn ? "bg-leaf-deep" : "bg-line-strong"}`}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left] ${eventsOn ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
    </div>
  );
}

function Swatches<T extends string>({ title, value, options, label, paint, render, lock, onPick }: {
  title: string; value: T; options: readonly T[]; label: (id: T) => string;
  /** 持っていないときの値段（持っていれば null） */
  lock?: (id: T) => number | null;
  /** 色や模様だけの見本 */
  paint?: (id: T) => React.CSSProperties;
  /** 実際の部屋と同じ描き方の見本 */
  render?: (id: T) => React.ReactNode;
  onPick: (id: T) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-black text-ink-soft">{title}</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {options.map((id) => (
          <button key={id} type="button" onClick={() => onPick(id)} aria-pressed={value === id} className="flex w-[70px] shrink-0 flex-col items-center gap-1">
            <span className={`relative block h-14 w-14 overflow-hidden rounded-2xl border shadow-sm ${value === id ? "border-leaf-deep ring-2 ring-leaf/50" : "border-line"}`} style={paint?.(id)}>
              {render?.(id)}
              {lock?.(id) != null ? <span className="absolute inset-0 flex items-start justify-end bg-white/35 p-0.5"><span className="rounded-full bg-[#2F6FC2] px-1 text-[9px] leading-[14px]">🔒</span></span> : null}
            </span>
            <span className={`w-full truncate text-center text-[10px] font-bold ${value === id ? "text-leaf-deep" : "text-ink-soft"}`}>{label(id)}</span>
            {lock?.(id) != null ? <span className="-mt-0.5 flex items-center gap-0.5 text-[9px] font-black tabular-nums text-[#2F6FC2]"><BlueCoinArt className="h-3 w-3" />{lock(id)!.toLocaleString()}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function Tool({ label, onClick, danger = false, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} onPointerDown={(e) => e.stopPropagation()} onClick={onClick} className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-bold active:scale-90 ${danger ? "bg-blossom-soft text-[#b94c60]" : "bg-paper-deep text-ink-soft"}`}>{children}</button>;
}

function Action({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label: string }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="min-h-9 rounded-xl border border-line bg-card px-2 text-[11px] font-bold text-ink-soft shadow-sm disabled:opacity-35 active:scale-[.97]">{label}</button>;
}
