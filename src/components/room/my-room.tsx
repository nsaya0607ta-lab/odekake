"use client";

/**
 * わんこのおへや
 * =============================================================
 * ふだんは「見るモード」：犬が暮らしていて、写真をタップすると思い出（場所・日付・ひとこと）が見られる。
 * 「もようがえ」で編集モードになり、下の引き出しから飾るものを置いたり、壁紙・床などを変えたりできる。
 * 動かすと少しあとに自動で保存する（DBが未適用の環境では端末に保存する）。
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconChevronLeft } from "@/components/icons";
import type { DogSkinId } from "@/lib/dog-skins";
import type { GachaRarity } from "@/lib/gacha/config";
import { CURTAIN_STYLES, FLOOR_STYLES, RUG_STYLES, WALLPAPER_STYLES } from "@/lib/room/themes";
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
  WALL_DECOS,
  type WallDeco,
  settle,
  shelfOf,
  uploadEntry,
  uploadKey,
  WALLPAPERS,
  type DecorEntry,
  type DecorKind,
  type Placement,
  type RoomLayout,
  type RoomPhoto,
  type RoomTheme,
} from "@/lib/room/types";
import { DecorVisual, FRAME_LABELS } from "./decor-visual";
import { RoomDog } from "./room-dog";
import { composeRoomSnapshot } from "./room-snapshot";
import { skyAt } from "@/lib/room/sun";
import { parseRoomWeather, withWeather, type RoomWeather } from "@/lib/room/weather";
import { dayPhaseOf, lampsOn, RoomLighting, RoomScene, type DayPhase } from "./room-scene";
import { DEFAULT_PLACE, SkyCard, type RoomPlace } from "./sky-card";

type Tab = DecorKind | "theme";
type ItemFilter = "all" | "toy" | "food" | "interior" | "other" | "sushi";
type SaveState = "saved" | "dirty" | "saving" | "local" | "error";

const LOCAL_KEY = "odekake-my-room-v1";
const HISTORY_LIMIT = 30;
const AUTOSAVE_MS = 1200;
const RARITY_ORDER: readonly GachaRarity[] = ["N", "R", "SR", "SSR", "UR", "LR", "MR"];

const TABS: Array<{ id: Tab; label: string; empty: string }> = [
  { id: "item", label: "アイテム", empty: "ガチャやミニゲームで図鑑アイテムを集めると、ここから置けます" },
  { id: "photo", label: "写真", empty: "" },
  { id: "trophy", label: "トロフィー", empty: "おさんぽフレンチーで遊ぶと、道ごとのトロフィーがもらえます" },
  { id: "pennant", label: "ペナント", empty: "おでかけを記録した都道府県のペナントがもらえます" },
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

/** 置いたものの幅（部屋の幅に対する %）。床の奥ほど小さく、棚の上は小さめ */
function widthOf(entry: DecorEntry, p: Placement): number {
  if (entry.kind === "photo") return 21 * p.scale;
  if (entry.kind === "furniture") return FURNITURE[entry.furniture].width * p.scale * depthScale(p.y);
  if (entry.kind === "pennant") return 19 * p.scale;
  const onShelf = shelfOf(p) !== null;
  const base = entry.kind === "trophy" ? (onShelf ? 12 : 13) : onShelf ? 11.5 : 15.5;
  return base * p.scale * (onShelf ? 1 : depthScale(p.y));
}

/** 壁に掛けるものを置く候補（窓・時計・棚をさけた場所） */
const WALL_SPOTS = [[48, 23], [48, 41], [21, 47], [60, 12], [91, 12], [35, 48], [8, 47]] as const;
/** 壁で、掛けるものを置きたくない場所（窓・時計・棚・ライト）。[x0, y0, x1, y1] */
const WALL_BLOCKS = [[4, 5, 40, 41], [67, 2, 85, 22], [56, 21, 96, 46], [43, 0, 57, 12]] as const;

/** 壁に掛けるものの置き場所：窓などに重ならず、すでに掛けてあるものからいちばん離れたところ */
function freeWallSpot(taken: readonly { x: number; y: number }[]): [number, number] {
  // 写真1枚ぶんの大きさ（幅21% × 高さ約16%）の四角で考える
  const hw = 11, hh = 8;
  const overlap = (ax0: number, ay0: number, ax1: number, ay1: number, bx0: number, by0: number, bx1: number, by1: number) =>
    Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0)) * Math.max(0, Math.min(ay1, by1) - Math.max(ay0, by0));
  let best: [number, number] = [WALL_SPOTS[0][0], WALL_SPOTS[0][1]], bestScore = -Infinity;
  for (let x = 14; x <= 86; x += 2) {
    for (let y = 10; y <= ROOM.wallBottom - 3; y += 2) {
      const box = [x - hw, y - hh, x + hw, y + hh] as const;
      const blocked = WALL_BLOCKS.reduce((sum, [x0, y0, x1, y1]) => sum + overlap(...box, x0, y0, x1, y1), 0);
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
const FURNITURE_DEPTH: Record<string, number> = { sofa: 0.35, plant: 0.2, bookshelf: 0.25, lamp: 0.2, table: 0.3, "dog-house": 0.35, bowl: 0.2, "dog-bed": 0.3 };

const FLOOR_SPOTS = [[22, 74], [78, 76], [64, 90], [36, 92], [86, 92], [14, 88], [50, 66], [70, 66]] as const;

/** はじめて開いたときの部屋：持っているものから少しだけ飾っておく */
function starterLayout(entries: DecorEntry[]): RoomLayout {
  const items: Placement[] = [];
  let z = 1;
  // サーバーと端末で同じ表示になるよう、最初の部屋の id は決まった値にする
  const put = (key: string, x: number, y: number) => items.push({ id: `starter-${z}`, key, x, y, scale: 1, flip: false, z: z++ });
  entries.filter((e) => e.kind === "photo").slice(0, 2).forEach((e, i) => put(e.key, WALL_SPOTS[i]![0], WALL_SPOTS[i]![1]));
  entries.filter((e) => e.kind === "pennant").slice(0, 1).forEach((e) => put(e.key, WALL_SPOTS[2]![0], WALL_SPOTS[2]![1]));
  entries.filter((e) => e.kind === "trophy").slice(0, 3).forEach((e, i) => put(e.key, 66 + i * 12, ROOM.shelves[0].y));
  const items4 = entries.filter((e): e is Extract<DecorEntry, { kind: "item" }> => e.kind === "item")
    .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)).slice(0, 4);
  items4.forEach((e, i) => (i === 3 ? put(e.key, 70, ROOM.shelves[1].y) : put(e.key, FLOOR_SPOTS[i]![0], FLOOR_SPOTS[i]![1])));
  // はじめから少しだけ家具を置いておく（犬はベッドで寝る）
  put("furniture:plant", 8, 66);
  put("furniture:dog-bed", 82, 91);
  return { theme: DEFAULT_THEME, items, photos: [] };
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

export function MyRoom({ entries, initialLayout, serverReady, dogSkin, dogName, serverNow }: {
  entries: DecorEntry[];
  initialLayout: RoomLayout | null;
  serverReady: boolean;
  dogSkin: DogSkinId;
  dogName: string;
  /** サーバーで描いた時刻。最初の表示をサーバーとそろえ、そのあと端末の時刻に合わせる */
  serverNow: string;
}) {
  // 家具はだれでも置けるので、持ち物と合わせて「置けるもの」にする
  const validKeys = useMemo(() => new Set([...entries, ...FURNITURE_ENTRIES].map((e) => e.key)), [entries]);
  const [layout, setLayout] = useState<RoomLayout>(() => initialLayout
    ? { ...initialLayout, items: initialLayout.items.filter((p) => validKeys.has(p.key) || p.key.startsWith("upload:")) }
    : starterLayout(entries));
  /** 持ち物に、アップロードした写真を足したもの（アップロードした写真を先に並べる） */
  const allEntries = useMemo(() => [...layout.photos.map(uploadEntry), ...entries, ...FURNITURE_ENTRIES], [entries, layout.photos]);
  const entryByKey = useMemo(() => new Map(allEntries.map((e) => [e.key, e])), [allEntries]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [past, setPast] = useState<RoomLayout[]>([]);
  const [future, setFuture] = useState<RoomLayout[]>([]);
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("item");
  const [filter, setFilter] = useState<ItemFilter>("all");
  const [saveState, setSaveState] = useState<SaveState>(serverReady ? "saved" : "local");
  const [toast, setToast] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ id: string; text: string; x: number; y: number } | null>(null);
  const [lightbox, setLightbox] = useState<Extract<DecorEntry, { kind: "photo" }> | null>(null);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [shooting, setShooting] = useState(false);
  const [shareBody, setShareBody] = useState("");
  const [shareState, setShareState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [shareError, setShareError] = useState("");
  const [now, setNow] = useState(() => new Date(serverNow));
  const roomRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; before: RoomLayout; moved: boolean; pointer: number } | null>(null);
  const latest = useRef(layout);
  latest.current = layout;
  const [place, setPlace] = useState<RoomPlace>(DEFAULT_PLACE);
  const phase: DayPhase = dayPhaseOf(now, place);
  const [weather, setWeather] = useState<RoomWeather | null>(null);
  const lightsOn = useMemo(() => lampsOn(withWeather(skyAt(now, place), weather)), [now, place, weather]);
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
        setPlace({ lat: raw.lat, lon: raw.lon, source: raw.source, pref: raw.pref });
      }
    } catch { /* 読めなければ東京のまま */ }
  }, []);
  // 窓の外の、いまの本当の天気（20分ごとに取り直す。取れなければ季節だけの景色）
  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch(`/api/my-room/weather?lat=${place.lat.toFixed(1)}&lon=${place.lon.toFixed(1)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (alive) setWeather(parseRoomWeather(j)); })
        .catch(() => { if (alive) setWeather(null); });
    };
    load();
    const t = window.setInterval(load, 20 * 60_000);
    return () => { alive = false; window.clearInterval(t); };
  }, [place.lat, place.lon]);
  const changePlace = useCallback((p: RoomPlace) => {
    setPlace(p);
    try { window.localStorage.setItem(PLACE_KEY, JSON.stringify(p)); } catch { /* 保存できなくてもこの画面では使える */ }
  }, []);

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
  const persist = useCallback(async () => {
    const snapshot = latest.current;
    if (!serverReady) {
      try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot)); setSaveState("local"); } catch { setSaveState("error"); }
      return;
    }
    setSaveState("saving");
    try {
      const response = await fetch("/api/my-room", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout: snapshot }) });
      if (!response.ok) throw new Error("save failed");
      const payload = (await response.json().catch(() => null)) as { ready?: boolean } | null;
      if (payload?.ready === false) { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot)); setSaveState("local"); return; }
      setSaveState(latest.current === snapshot ? "saved" : "dirty");
    } catch {
      setSaveState("error");
    }
  }, [serverReady]);
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
      if (serverReady) void fetch("/api/my-room", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout: latest.current }), keepalive: true });
      else try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(latest.current)); } catch { /* 保存できない端末 */ }
    };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [serverReady]);

  /* ---------- 変更 ---------- */
  const commit = useCallback((next: RoomLayout, before: RoomLayout = latest.current) => {
    setPast((p) => [...p.slice(-(HISTORY_LIMIT - 1)), before]);
    setFuture([]);
    setLayout(next);
    setSaveState("dirty");
  }, []);
  const changeItem = (id: string, change: (p: Placement) => Placement) => commit({ ...layout, items: layout.items.map((p) => (p.id === id ? change(p) : p)) });
  const setTheme = (patch: Partial<RoomTheme>) => commit({ ...layout, theme: { ...layout.theme, ...patch } });
  const topZ = () => Math.max(0, ...layout.items.map((p) => p.z)) + 1;

  function addEntry(entry: DecorEntry, base: RoomLayout = layout) {
    const placed = base.items.filter((p) => p.key === entry.key);
    if (placed.length >= entry.count) { setSelectedId(placed[0]?.id ?? null); flash(entry.count > 1 ? "持っている数だけ置いています" : "もう飾っています"); return; }
    if (base.items.length >= ROOM_MAX_ITEMS) { if (base !== layout) commit(base); flash(`飾れるのは${ROOM_MAX_ITEMS}こまでです`); return; }
    let x: number, y: number;
    if (isHanging(entry.kind)) {
      const hanging = base.items.filter((p) => { const e = entryByKey.get(p.key); return (e && isHanging(e.kind)) || p.key.startsWith("upload:"); });
      [x, y] = freeWallSpot(hanging);
    } else if (entry.kind === "trophy") {
      const onShelf = base.items.filter((p) => shelfOf(p)).length;
      const shelf = ROOM.shelves[onShelf < 6 ? 0 : 1];
      [x, y] = [shelf.x0 + 7 + ((onShelf * 11) % (shelf.x1 - shelf.x0 - 12)), shelf.y];
    } else {
      const n = base.items.length;
      [x, y] = FLOOR_SPOTS[n % FLOOR_SPOTS.length]!;
      x = clamp(x + ((n * 7) % 9) - 4, 6, 94);
    }
    const p: Placement = { id: newId(), key: entry.key, x, y, scale: 1, flip: false, z: topZ(), ...(entry.kind === "photo" ? { frame: "wood" as const } : {}) };
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
    const next = settle(entry.kind, at.x - d.dx, at.y - d.dy);
    if (!d.moved && Math.hypot(next.x - p.x, next.y - p.y) < 0.8) return;
    d.moved = true;
    setLayout((cur) => ({ ...cur, items: cur.items.map((it) => (it.id === p.id ? { ...it, ...next } : it)) }));
  }
  function onItemUp(e: React.PointerEvent, p: Placement) {
    const d = drag.current;
    if (!d || d.id !== p.id) return;
    drag.current = null;
    if (d.moved) { setPast((ps) => [...ps.slice(-(HISTORY_LIMIT - 1)), d.before]); setFuture([]); setSaveState("dirty"); }
    void e;
  }
  /** 見るモードでタップ：写真は思い出を開き、ほかは名前を少し出す */
  function onItemTap(p: Placement, el?: HTMLElement) {
    if (editing) return;
    const entry = entryByKey.get(p.key);
    if (!entry) return;
    if (entry.kind === "photo") { setLightbox(entry); return; }
    const text = entry.kind === "item" ? `${entry.rarity} ${entry.name}` : entry.kind === "trophy" ? `${entry.name}　ベスト ${entry.score.toLocaleString("ja-JP")}点（${entry.rank}）` : `${entry.name}のペナント`;
    // 名前は夜の暗さより上に出すので、部屋の中の位置（そのものの上のはし）を覚えておく
    const r = el?.getBoundingClientRect(), room = roomRef.current?.getBoundingClientRect();
    const at = r && room ? { x: ((r.left + r.width / 2 - room.left) / room.width) * 100, y: ((r.top - room.top) / room.height) * 100 } : { x: p.x, y: p.y };
    setPeek({ id: p.id, text, ...at });
    window.setTimeout(() => setPeek((cur) => (cur?.id === p.id ? null : cur)), 2200);
  }

  /* ---------- 描く順番（壁 → 棚 → 床と犬は手前ほど上） ---------- */
  const zIndexOf = useMemo(() => {
    const hanging = layout.items.filter((p) => { const e = entryByKey.get(p.key); return e && isHanging(e.kind); }).sort((a, b) => a.z - b.z);
    const shelved = layout.items.filter((p) => { const e = entryByKey.get(p.key); return e && !isHanging(e.kind) && shelfOf(p); }).sort((a, b) => a.z - b.z);
    const map = new Map<string, number>();
    hanging.forEach((p, i) => map.set(p.id, 20 + i));
    shelved.forEach((p, i) => map.set(p.id, 160 + i));
    for (const p of layout.items) if (!map.has(p.id)) map.set(p.id, 300 + Math.round(p.y * 10));
    return map;
  }, [entryByKey, layout.items]);

  const dogLines = useMemo(() => {
    const placed = layout.items.map((p) => entryByKey.get(p.key)).filter((e): e is DecorEntry => Boolean(e));
    const lines = [phase === "morning" ? "おはよう！ きょうはどこ行く？" : phase === "evening" ? "おかえり！ おさんぽ行こ？" : "わん！ なでてくれてうれしい", "このおへや、だいすき！"];
    for (const e of placed.slice(0, 30)) {
      if (e.kind === "photo") lines.push(`${e.name}、また行きたいね！`);
      else if (e.kind === "trophy") lines.push(`${e.stage}のトロフィー、かっこいいでしょ`);
      else if (e.kind === "pennant") lines.push(`${e.name}の思い出、たのしかったね`);
      else lines.push(`${e.name}、気に入ってるよ！`);
    }
    return lines;
  }, [entryByKey, layout.items, phase]);

  /** フロアランプの明かり（夜はそのまわりが明るい） */
  const lampLights = useMemo(() => layout.items
    .filter((p) => p.key === "furniture:lamp")
    .map((p) => ({ x: p.x, y: p.y - 15 * p.scale * depthScale(p.y), r: 20 * p.scale })), [layout.items]);

  /** 犬が向かう場所（ベッド・ごはん皿・床のもの） */
  const dogPlaces = useMemo(() => {
    const floor = layout.items.filter((p) => { const e = entryByKey.get(p.key); return e && !isHanging(e.kind) && !shelfOf(p); });
    const furn = (id: string) => floor.find((p) => p.key === `furniture:${id}`);
    const bed = furn("dog-bed") ?? furn("dog-house"), bowl = furn("bowl");
    return {
      // ベッドではクッションの上（少し奥）に寝て、ベッドより手前に描く。ハウスでは入り口の前
      bed: bed ? (bed.key === "furniture:dog-house" ? { x: bed.x, y: clamp(bed.y + 1.5, ROOM.floorTop, ROOM.floorBottom), zy: bed.y + 2 } : { x: bed.x, y: bed.y - 1.5, zy: bed.y + 0.5 }) : null,
      bowl: bowl ? { x: bowl.x, y: bowl.y } : null,
      toys: floor.filter((p) => entryByKey.get(p.key)?.kind === "item").map((p) => ({ x: p.x, y: p.y, name: entryByKey.get(p.key)!.name })),
      // 家具のあるところ（犬は家具の上を歩かず、ここをよけて回りこむ。ベッドとハウスだけは中へ入る）
      blocks: floor.flatMap((p) => {
        const e = entryByKey.get(p.key);
        if (!e || e.kind !== "furniture") return [];
        const w = widthOf(e, p);
        return [{ x0: p.x - w / 2 - 3, x1: p.x + w / 2 + 3, y0: p.y - (w * (FURNITURE_DEPTH[e.furniture] ?? 0.3)) / ROOM.aspect, y1: p.y + 3 }];
      }),
    };
  }, [entryByKey, layout.items]);

  const selected = layout.items.find((p) => p.id === selectedId) ?? null;
  const selectedEntry = selected ? entryByKey.get(selected.key) ?? null : null;
  const counts = useMemo(() => {
    const c: Record<DecorKind, number> = { item: 0, photo: 0, trophy: 0, pennant: 0, furniture: 0 };
    for (const e of allEntries) c[e.kind] += 1;
    return c;
  }, [allEntries]);
  const tabEntries = useMemo(() => allEntries.filter((e) => {
    if (tab === "theme" || e.kind !== tab) return false;
    if (e.kind !== "item" || filter === "all") return true;
    if (filter === "sushi") return e.series === "sushi";
    return e.category === filter;
  }), [allEntries, filter, tab]);
  const saveLabel = saveState === "saving" ? "保存中…" : saveState === "dirty" ? "保存待ち" : saveState === "error" ? "保存できませんでした" : saveState === "local" ? "この端末に保存" : "保存ずみ";

  /* ---------- 記念撮影 ---------- */
  async function takeSnapshot() {
    const room = roomRef.current;
    if (!room || shooting) return;
    setShooting(true);
    setSelectedId(null);
    try {
      // パシャッ（白く光らせる）
      room.animate?.([{ filter: "brightness(1.8)" }, { filter: "brightness(1)" }], { duration: 380, easing: "ease-out" });
      const blob = await composeRoomSnapshot(room, {
        title: `${dogName}のおへや`,
        sub: fmtDate(new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date())),
        fontFamily: getComputedStyle(document.body).fontFamily,
      });
      if (shot) URL.revokeObjectURL(shot.url);
      setShot({ blob, url: URL.createObjectURL(blob) });
      setShareBody(`${dogName}のおへやを もようがえしたよ🏠`);
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
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: `${dogName}のおへや` }); return; }
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

  return (
    <main className="min-h-dvh bg-paper pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-ink">
      <header className="sticky top-0 z-[600] border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-3">
          <Link href="/mypage" aria-label="マイページへ戻る" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-paper-deep">
            <IconChevronLeft size={24} />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-bold tracking-[0.18em] text-leaf-deep">MY ROOM</p>
            <h1 className="truncate text-[17px] font-black">{dogName}のおへや</h1>
          </div>
          {editing ? (
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

      <div className="mx-auto max-w-lg">
        <div
          ref={roomRef}
          className={`isolate w-full touch-none select-none overflow-hidden ${editing ? "sticky top-14 z-[50] shadow-[0_8px_16px_-10px_rgba(60,40,20,.35)]" : "relative"}`}
          style={{ aspectRatio: `1000 / ${1000 * ROOM.aspect}` }}
          onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as Element).tagName === "svg" || (e.target as Element).closest("svg[aria-hidden]")) setSelectedId(null); }}
        >
          <RoomScene theme={layout.theme} now={now} at={place} weather={weather} />

          {layout.items.map((p) => {
            const entry = entryByKey.get(p.key);
            if (!entry) return null;
            const hang = isHanging(entry.kind);
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
                  width: `${widthOf(entry, p)}%`,
                  zIndex: zIndexOf.get(p.id),
                  transform: `translate(-50%, ${hang ? "-50%" : "-100%"}) ${entry.kind === "pennant" ? "rotate(-4deg)" : ""}`,
                  touchAction: "none",
                }}
                onPointerDown={(e) => onItemDown(e, p)}
                onPointerMove={(e) => onItemMove(e, p)}
                onPointerUp={(e) => onItemUp(e, p)}
                onPointerCancel={(e) => onItemUp(e, p)}
                onClick={(e) => onItemTap(p, e.currentTarget)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (editing) setSelectedId(p.id); else onItemTap(p); } }}
              >
                {!hang && !shelfOf(p) ? <span data-shadow className="pointer-events-none absolute -bottom-[4%] left-1/2 h-[10%] w-[78%] -translate-x-1/2 rounded-[50%] bg-[#4a3520]/18 blur-[2px]" /> : null}
                {/* 棚の上：板に落ちる小さな影 */}
                {!hang && shelfOf(p) ? <span data-shadow className="pointer-events-none absolute -bottom-[3%] left-1/2 h-[7%] w-[84%] -translate-x-1/2 rounded-[50%] bg-[#3a2410]/30 blur-[1.5px]" /> : null}
                <span data-body className="relative block" style={{ transform: p.flip ? "scaleX(-1)" : undefined }}>
                  <DecorVisual entry={entry} frame={p.frame} lit={lightsOn} />
                </span>
                {isSel ? (
                  <span className="room-selected pointer-events-none absolute -inset-2 rounded-xl border-2 border-white/90 shadow-[0_0_0_2px_rgba(94,140,74,.9),0_0_16px_rgba(140,200,110,.75)]">
                    {["-left-1.5 -top-1.5", "-right-1.5 -top-1.5", "-bottom-1.5 -left-1.5", "-bottom-1.5 -right-1.5"].map((pos) => <span key={pos} className={`absolute h-3 w-3 rounded-full border-2 border-white bg-leaf-deep shadow ${pos}`} />)}
                  </span>
                ) : null}

              </div>
            );
          })}

          <RoomDog skin={dogSkin} phase={phase} sleepy={sleepy} lines={dogLines} quiet={editing} places={dogPlaces} weather={weather?.kind ?? null} />
          <div className="pointer-events-none absolute inset-0" style={{ zIndex: 2000 }}>
            <RoomLighting now={now} lamps={lampLights} at={place} weather={weather} />
          </div>
          {peek ? (
            <span className="room-bubble pointer-events-none absolute w-max max-w-[12rem] -translate-x-1/2 -translate-y-full rounded-xl bg-ink px-2.5 py-1 text-[10px] font-bold text-white shadow" style={{ left: `${clamp(peek.x, 18, 82)}%`, top: `${Math.max(4, peek.y - 0.5)}%`, zIndex: 2600 }}>{peek.text}</span>
          ) : null}

          {editing && selected && selectedEntry ? (
            <div className="absolute bottom-2 left-1/2 z-[3000] flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-card/95 p-1.5 shadow-lg backdrop-blur">
              <Tool label="小さく" onClick={() => changeItem(selected.id, (p) => ({ ...p, scale: clamp(p.scale - 0.12, 0.5, 2) }))}>−</Tool>
              <Tool label="大きく" onClick={() => changeItem(selected.id, (p) => ({ ...p, scale: clamp(p.scale + 0.12, 0.5, 2) }))}>＋</Tool>
              <Tool label="左右反転" onClick={() => changeItem(selected.id, (p) => ({ ...p, flip: !p.flip }))}>↔</Tool>
              <Tool label="いちばん前へ" onClick={() => changeItem(selected.id, (p) => ({ ...p, z: topZ() }))}>⇡</Tool>
              {selectedEntry.kind === "photo" ? (
                <Tool label="額縁を変える" onClick={() => changeItem(selected.id, (p) => ({ ...p, frame: FRAME_STYLES[(FRAME_STYLES.indexOf(p.frame ?? "wood") + 1) % FRAME_STYLES.length] }))}>
                  <span className="text-[10px] font-black">{FRAME_LABELS[selected.frame ?? "wood"]}</span>
                </Tool>
              ) : null}
              {selectedEntry.kind === "photo" && selectedEntry.upload ? (
                <Tool label="写真のなまえ" onClick={() => renameUpload(selectedEntry.key.slice("upload:".length))}>✎</Tool>
              ) : null}
              <Tool danger label="片づける" onClick={() => { commit({ ...layout, items: layout.items.filter((p) => p.id !== selected.id) }); setSelectedId(null); }}>🗑</Tool>
            </div>
          ) : null}
        </div>

        {editing ? (
          <>
            <div className="grid grid-cols-3 gap-2 border-y border-line bg-paper-deep px-4 py-2">
              <Action disabled={!past.length} onClick={undo} label="↶ 元に戻す" />
              <Action disabled={!future.length} onClick={redo} label="↷ やり直す" />
              <Action disabled={!layout.items.length} onClick={() => { commit({ ...layout, items: [] }); setSelectedId(null); }} label="ぜんぶ片づける" />
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
                {tab === "theme" ? "壁紙・床・カーテン・ラグを選べます" : tab === "photo" ? "スマホの写真や、おでかけ記録の写真を額に入れて飾れます" : "タップで飾る・ドラッグで動かす（アイテムは棚にも乗せられます）"}
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
              {tab === "theme" ? (
                <ThemePicker theme={layout.theme} onChange={setTheme} />
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
                          <span className="block w-[78%]"><DecorVisual entry={e} thumb /></span>
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
        ) : (
          <section className="space-y-3 px-4 pt-4">
            <div className="grid grid-cols-4 gap-2">
              {([["item", "アイテム", "🧸"], ["photo", "写真", "🖼️"], ["trophy", "トロフィー", "🏆"], ["pennant", "ペナント", "🚩"]] as const).map(([kind, label, icon]) => {
                const n = layout.items.filter((p) => entryByKey.get(p.key)?.kind === kind).length;
                return (
                  <div key={kind} className="rounded-2xl border border-line bg-card px-1 py-2 text-center shadow-sm">
                    <div className="text-lg leading-none">{icon}</div>
                    <div className="mt-1 text-[15px] font-black tabular-nums">{n}<span className="text-[10px] font-bold text-ink-faint">/{counts[kind]}</span></div>
                    <div className="text-[10px] font-bold text-ink-soft">{label}</div>
                  </div>
                );
              })}
            </div>
            <SkyCard now={now} place={place} onPlace={changePlace} weather={weather} />
            <ul className="space-y-1.5 rounded-2xl border border-line bg-card px-4 py-3 text-[12px] leading-relaxed text-ink-soft shadow-sm">
              <li>🐾 {dogName}をタップすると、なでられます</li>
              <li>🖼️ 飾った写真をタップすると、その日の思い出が見られます</li>
              <li>🕰️ 窓の外・部屋の明るさ・時計は、住んでいるところ（📍で変えられます）の、いまの時刻・天気と、季節の日の出・日の入りに合わせて変わります</li>
              <li>🚩 おでかけを記録した都道府県のペナントや、おさんぽのトロフィーも飾れます</li>
            </ul>
            <button type="button" onClick={() => void takeSnapshot()} disabled={shooting} className="flex w-full items-center justify-center gap-2 rounded-full bg-leaf-deep py-3 text-sm font-black text-white shadow-md active:scale-[.98] disabled:opacity-60">
              <span aria-hidden="true">📷</span>{shooting ? "撮影中…" : "記念撮影する"}
            </button>
            <p className="text-center text-[10px] font-semibold text-ink-faint">{saveLabel}</p>
          </section>
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

      {toast ? <div className="fixed bottom-6 left-1/2 z-[800] -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-xs font-bold text-white shadow-lg">{toast}</div> : null}
    </main>
  );
}

const DECO_LABELS: Record<WallDeco, string> = { none: "なし", garland: "ガーランド", lights: "ライト", stars: "お星さま" };
const DECO_SWATCH: Record<WallDeco, string> = {
  none: "repeating-linear-gradient(45deg, #fff 0 6px, #eee 6px 12px)",
  garland: "conic-gradient(from 180deg at 50% 0%, #F2A7B8 0 60deg, #8DBDE6 60deg 120deg, #F2D16B 120deg 180deg, #FFF 180deg)",
  lights: "radial-gradient(circle at 30% 50%, #FFE38A 0 5px, transparent 6px), radial-gradient(circle at 70% 50%, #FFB3C7 0 5px, transparent 6px), #3B3F7A",
  stars: "radial-gradient(circle at 35% 40%, #F6E7A8 0 4px, transparent 5px), radial-gradient(circle at 65% 65%, #F6E7A8 0 3px, transparent 4px), #FBF3E4",
};

function ThemePicker({ theme, onChange }: { theme: RoomTheme; onChange: (patch: Partial<RoomTheme>) => void }) {
  return (
    <div className="mt-3 space-y-4">
      <Swatches title="壁紙" value={theme.wall} options={WALLPAPERS} label={(id) => WALLPAPER_STYLES[id].label} paint={(id) => ({ background: `radial-gradient(circle at 30% 30%, ${WALLPAPER_STYLES[id].ink} 0 22%, transparent 23%), ${WALLPAPER_STYLES[id].base}` })} onPick={(wall) => onChange({ wall })} />
      <Swatches title="床" value={theme.floor} options={FLOORS} label={(id) => FLOOR_STYLES[id].label} paint={(id) => ({ background: `repeating-linear-gradient(90deg, ${FLOOR_STYLES[id].base} 0 10px, ${FLOOR_STYLES[id].line} 10px 12px)` })} onPick={(floor) => onChange({ floor })} />
      <Swatches title="カーテン" value={theme.curtain} options={CURTAINS} label={(id) => CURTAIN_STYLES[id].label} paint={(id) => ({ background: CURTAIN_STYLES[id].color })} onPick={(curtain) => onChange({ curtain })} />
      <Swatches title="壁のかざり" value={theme.deco} options={WALL_DECOS} label={(id) => DECO_LABELS[id]} paint={(id) => ({ background: DECO_SWATCH[id] })} onPick={(deco) => onChange({ deco })} />
      <Swatches title="ラグ" value={theme.rug} options={RUGS} label={(id) => RUG_STYLES[id].label} paint={(id) => (id === "none" ? { background: "repeating-linear-gradient(45deg, #fff 0 6px, #eee 6px 12px)" } : { background: RUG_STYLES[id].color })} onPick={(rug) => onChange({ rug })} />
    </div>
  );
}

function Swatches<T extends string>({ title, value, options, label, paint, onPick }: {
  title: string; value: T; options: readonly T[]; label: (id: T) => string; paint: (id: T) => React.CSSProperties; onPick: (id: T) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-black text-ink-soft">{title}</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {options.map((id) => (
          <button key={id} type="button" onClick={() => onPick(id)} aria-pressed={value === id} className="flex w-[64px] shrink-0 flex-col items-center gap-1">
            <span className={`block h-12 w-12 rounded-2xl border shadow-sm ${value === id ? "border-leaf-deep ring-2 ring-leaf/50" : "border-line"}`} style={paint(id)} />
            <span className={`w-full truncate text-center text-[10px] font-bold ${value === id ? "text-leaf-deep" : "text-ink-soft"}`}>{label(id)}</span>
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
