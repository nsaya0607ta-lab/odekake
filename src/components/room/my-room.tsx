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
  RUGS,
  settle,
  shelfOf,
  WALLPAPERS,
  type DecorEntry,
  type DecorKind,
  type Placement,
  type RoomLayout,
  type RoomTheme,
} from "@/lib/room/types";
import { DecorVisual, FRAME_LABELS } from "./decor-visual";
import { RoomDog } from "./room-dog";
import { dayPhaseOf, RoomScene, type DayPhase } from "./room-scene";

type Tab = DecorKind | "theme";
type ItemFilter = "all" | "toy" | "food" | "interior" | "other" | "sushi";
type SaveState = "saved" | "dirty" | "saving" | "local" | "error";

const LOCAL_KEY = "odekake-my-room-v1";
const HISTORY_LIMIT = 30;
const AUTOSAVE_MS = 1200;
const RARITY_ORDER: readonly GachaRarity[] = ["N", "R", "SR", "SSR", "UR", "LR", "MR"];

const TABS: Array<{ id: Tab; label: string; empty: string }> = [
  { id: "item", label: "アイテム", empty: "ガチャやミニゲームで図鑑アイテムを集めると、ここから置けます" },
  { id: "photo", label: "写真", empty: "おでかけ記録に写真を登録すると、額に入れて飾れます" },
  { id: "trophy", label: "トロフィー", empty: "おさんぽフレンチーで遊ぶと、道ごとのトロフィーがもらえます" },
  { id: "pennant", label: "ペナント", empty: "おでかけを記録した都道府県のペナントがもらえます" },
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
  if (entry.kind === "pennant") return 19 * p.scale;
  const onShelf = shelfOf(p) !== null;
  const base = entry.kind === "trophy" ? (onShelf ? 12 : 13) : onShelf ? 11.5 : 15.5;
  return base * p.scale * (onShelf ? 1 : depthScale(p.y));
}

/** 壁に掛けるものを置く候補（窓・時計・棚をさけた場所） */
const WALL_SPOTS = [[48, 23], [48, 41], [21, 47], [60, 12], [91, 12], [35, 48], [8, 47]] as const;
const FLOOR_SPOTS = [[22, 74], [78, 76], [64, 90], [36, 92], [86, 92], [14, 88], [50, 66], [70, 66]] as const;

/** はじめて開いたときの部屋：持っているものから少しだけ飾っておく */
function starterLayout(entries: DecorEntry[]): RoomLayout {
  const items: Placement[] = [];
  let z = 1;
  const put = (key: string, x: number, y: number) => items.push({ id: newId(), key, x, y, scale: 1, flip: false, z: z++ });
  entries.filter((e) => e.kind === "photo").slice(0, 2).forEach((e, i) => put(e.key, WALL_SPOTS[i]![0], WALL_SPOTS[i]![1]));
  entries.filter((e) => e.kind === "pennant").slice(0, 1).forEach((e) => put(e.key, WALL_SPOTS[2]![0], WALL_SPOTS[2]![1]));
  entries.filter((e) => e.kind === "trophy").slice(0, 3).forEach((e, i) => put(e.key, 66 + i * 12, ROOM.shelves[0].y));
  const items4 = entries.filter((e): e is Extract<DecorEntry, { kind: "item" }> => e.kind === "item")
    .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)).slice(0, 4);
  items4.forEach((e, i) => (i === 3 ? put(e.key, 70, ROOM.shelves[1].y) : put(e.key, FLOOR_SPOTS[i]![0], FLOOR_SPOTS[i]![1])));
  return { theme: DEFAULT_THEME, items };
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
  const validKeys = useMemo(() => new Set(entries.map((e) => e.key)), [entries]);
  const entryByKey = useMemo(() => new Map(entries.map((e) => [e.key, e])), [entries]);
  const [layout, setLayout] = useState<RoomLayout>(() => initialLayout
    ? { ...initialLayout, items: initialLayout.items.filter((p) => validKeys.has(p.key)) }
    : starterLayout(entries));
  const [past, setPast] = useState<RoomLayout[]>([]);
  const [future, setFuture] = useState<RoomLayout[]>([]);
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("item");
  const [filter, setFilter] = useState<ItemFilter>("all");
  const [saveState, setSaveState] = useState<SaveState>(serverReady ? "saved" : "local");
  const [toast, setToast] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ id: string; text: string } | null>(null);
  const [lightbox, setLightbox] = useState<Extract<DecorEntry, { kind: "photo" }> | null>(null);
  const [now, setNow] = useState(() => new Date(serverNow));
  const roomRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; before: RoomLayout; moved: boolean; pointer: number } | null>(null);
  const latest = useRef(layout);
  latest.current = layout;
  const phase: DayPhase = dayPhaseOf(now);

  // 時計と時間帯のために、1分ごとに今の時刻を更新する
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
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

  function addEntry(entry: DecorEntry) {
    const placed = layout.items.filter((p) => p.key === entry.key);
    if (placed.length >= entry.count) { setSelectedId(placed[0]?.id ?? null); flash(entry.count > 1 ? "持っている数だけ置いています" : "もう飾っています"); return; }
    if (layout.items.length >= ROOM_MAX_ITEMS) { flash(`飾れるのは${ROOM_MAX_ITEMS}こまでです`); return; }
    let x: number, y: number;
    if (isHanging(entry.kind)) {
      const n = layout.items.filter((p) => { const e = entryByKey.get(p.key); return e && isHanging(e.kind); }).length;
      [x, y] = WALL_SPOTS[n % WALL_SPOTS.length]!;
      x += (Math.floor(n / WALL_SPOTS.length) % 3) * 4;
    } else if (entry.kind === "trophy") {
      const onShelf = layout.items.filter((p) => shelfOf(p)).length;
      const shelf = ROOM.shelves[onShelf < 6 ? 0 : 1];
      [x, y] = [shelf.x0 + 7 + ((onShelf * 11) % (shelf.x1 - shelf.x0 - 12)), shelf.y];
    } else {
      const n = layout.items.length;
      [x, y] = FLOOR_SPOTS[n % FLOOR_SPOTS.length]!;
      x = clamp(x + ((n * 7) % 9) - 4, 6, 94);
    }
    const p: Placement = { id: newId(), key: entry.key, x, y, scale: 1, flip: false, z: topZ(), ...(entry.kind === "photo" ? { frame: "wood" as const } : {}) };
    commit({ ...layout, items: [...layout.items, p] });
    setSelectedId(p.id);
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
  function onItemTap(p: Placement) {
    if (editing) return;
    const entry = entryByKey.get(p.key);
    if (!entry) return;
    if (entry.kind === "photo") { setLightbox(entry); return; }
    const text = entry.kind === "item" ? `${entry.rarity} ${entry.name}` : entry.kind === "trophy" ? `${entry.name}　ベスト ${entry.score.toLocaleString("ja-JP")}点（${entry.rank}）` : `${entry.name}のペナント`;
    setPeek({ id: p.id, text });
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

  const selected = layout.items.find((p) => p.id === selectedId) ?? null;
  const selectedEntry = selected ? entryByKey.get(selected.key) ?? null : null;
  const counts = useMemo(() => {
    const c: Record<DecorKind, number> = { item: 0, photo: 0, trophy: 0, pennant: 0 };
    for (const e of entries) c[e.kind] += 1;
    return c;
  }, [entries]);
  const tabEntries = useMemo(() => entries.filter((e) => {
    if (tab === "theme" || e.kind !== tab) return false;
    if (e.kind !== "item" || filter === "all") return true;
    if (filter === "sushi") return e.series === "sushi";
    return e.category === filter;
  }), [entries, filter, tab]);
  const saveLabel = saveState === "saving" ? "保存中…" : saveState === "dirty" ? "保存待ち" : saveState === "error" ? "保存できませんでした" : saveState === "local" ? "この端末に保存" : "保存ずみ";

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
          className="relative isolate w-full touch-none select-none overflow-hidden"
          style={{ aspectRatio: `1000 / ${1000 * ROOM.aspect}` }}
          onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as Element).tagName === "svg" || (e.target as Element).closest("svg[aria-hidden]")) setSelectedId(null); }}
        >
          <RoomScene theme={layout.theme} phase={phase} now={now} />

          {layout.items.map((p) => {
            const entry = entryByKey.get(p.key);
            if (!entry) return null;
            const hang = isHanging(entry.kind);
            const isSel = editing && p.id === selectedId;
            return (
              <div
                key={p.id}
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
                onClick={() => onItemTap(p)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (editing) setSelectedId(p.id); else onItemTap(p); } }}
              >
                {!hang && !shelfOf(p) ? <span className="pointer-events-none absolute -bottom-[4%] left-1/2 h-[10%] w-[78%] -translate-x-1/2 rounded-[50%] bg-[#4a3520]/18 blur-[2px]" /> : null}
                <span className="relative block" style={{ transform: p.flip ? "scaleX(-1)" : undefined }}>
                  <DecorVisual entry={entry} frame={p.frame} />
                </span>
                {isSel ? <span className="pointer-events-none absolute -inset-1.5 rounded-lg border-2 border-dashed border-leaf-deep" /> : null}
                {peek?.id === p.id ? (
                  <span className="room-bubble pointer-events-none absolute bottom-full left-1/2 mb-1 w-max max-w-[12rem] -translate-x-1/2 rounded-xl bg-ink px-2.5 py-1 text-[10px] font-bold text-white shadow">{peek.text}</span>
                ) : null}
              </div>
            );
          })}

          <RoomDog skin={dogSkin} phase={phase} lines={dogLines} quiet={editing} />

          {editing && selected && selectedEntry ? (
            <div className="absolute bottom-2 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-card/95 p-1.5 shadow-lg backdrop-blur">
              <Tool label="小さく" onClick={() => changeItem(selected.id, (p) => ({ ...p, scale: clamp(p.scale - 0.12, 0.5, 2) }))}>−</Tool>
              <Tool label="大きく" onClick={() => changeItem(selected.id, (p) => ({ ...p, scale: clamp(p.scale + 0.12, 0.5, 2) }))}>＋</Tool>
              <Tool label="左右反転" onClick={() => changeItem(selected.id, (p) => ({ ...p, flip: !p.flip }))}>↔</Tool>
              <Tool label="いちばん前へ" onClick={() => changeItem(selected.id, (p) => ({ ...p, z: topZ() }))}>⇡</Tool>
              {selectedEntry.kind === "photo" ? (
                <Tool label="額縁を変える" onClick={() => changeItem(selected.id, (p) => ({ ...p, frame: FRAME_STYLES[(FRAME_STYLES.indexOf(p.frame ?? "wood") + 1) % FRAME_STYLES.length] }))}>
                  <span className="text-[10px] font-black">{FRAME_LABELS[selected.frame ?? "wood"]}</span>
                </Tool>
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
                {tab === "theme" ? "壁紙・床・カーテン・ラグを選べます" : "タップで飾る・ドラッグで動かす（アイテムは棚にも乗せられます）"}
              </p>
              {tab === "item" ? (
                <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
                  {ITEM_FILTERS.map((f) => (
                    <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${filter === f.id ? "border-leaf bg-leaf-soft text-leaf-deep" : "border-line bg-paper text-ink-soft"}`}>{f.label}</button>
                  ))}
                </div>
              ) : null}
              {tab === "theme" ? (
                <ThemePicker theme={layout.theme} onChange={setTheme} />
              ) : tabEntries.length ? (
                <div className="mt-2 grid grid-cols-3 gap-2.5">
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
            <ul className="space-y-1.5 rounded-2xl border border-line bg-card px-4 py-3 text-[12px] leading-relaxed text-ink-soft shadow-sm">
              <li>🐾 {dogName}をタップすると、なでられます</li>
              <li>🖼️ 飾った写真をタップすると、その日の思い出が見られます</li>
              <li>🕰️ 窓の外と時計は、いまの時間に合わせて変わります</li>
              <li>🚩 おでかけを記録した都道府県のペナントや、おさんぽのトロフィーも飾れます</li>
            </ul>
            <p className="text-center text-[10px] font-semibold text-ink-faint">{saveLabel}</p>
          </section>
        )}
      </div>

      {lightbox ? (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-[#140f22]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${lightbox.name}の思い出`} onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}>
          <div className="room-bubble w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.full} alt={lightbox.name} className="block max-h-[58vh] w-full bg-paper-deep object-contain" />
            <div className="space-y-1 px-4 pb-4 pt-3">
              <p className="text-base font-black">{lightbox.name}</p>
              <p className="text-xs font-semibold text-ink-faint">{[lightbox.pref, fmtDate(lightbox.date)].filter(Boolean).join(" ・ ")}</p>
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

function ThemePicker({ theme, onChange }: { theme: RoomTheme; onChange: (patch: Partial<RoomTheme>) => void }) {
  return (
    <div className="mt-3 space-y-4">
      <Swatches title="壁紙" value={theme.wall} options={WALLPAPERS} label={(id) => WALLPAPER_STYLES[id].label} paint={(id) => ({ background: `radial-gradient(circle at 30% 30%, ${WALLPAPER_STYLES[id].ink} 0 22%, transparent 23%), ${WALLPAPER_STYLES[id].base}` })} onPick={(wall) => onChange({ wall })} />
      <Swatches title="床" value={theme.floor} options={FLOORS} label={(id) => FLOOR_STYLES[id].label} paint={(id) => ({ background: `repeating-linear-gradient(90deg, ${FLOOR_STYLES[id].base} 0 10px, ${FLOOR_STYLES[id].line} 10px 12px)` })} onPick={(floor) => onChange({ floor })} />
      <Swatches title="カーテン" value={theme.curtain} options={CURTAINS} label={(id) => CURTAIN_STYLES[id].label} paint={(id) => ({ background: CURTAIN_STYLES[id].color })} onPick={(curtain) => onChange({ curtain })} />
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
