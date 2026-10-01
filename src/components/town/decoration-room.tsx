"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconChevronLeft, IconLayers, IconTrash } from "@/components/icons";
import type { CollectionCategory } from "@/lib/collection/items";
import type { GachaRarity } from "@/lib/gacha/config";
import { clampNumber, parsePlacements, ROOM_MAX_PLACEMENTS, type DecorEntry, type DecorKind, type Placement } from "@/lib/room/decor";

type Tab = DecorKind;
type ItemFilter = "all" | CollectionCategory | "sushi";
type SaveState = "saved" | "dirty" | "saving" | "local" | "error";

/** 以前の、端末にだけ保存していたころの置き方。サーバーに何も無ければここから引き継ぐ */
const LEGACY_STORAGE_KEY = "odekake-decoration-room-v1";
const HISTORY_LIMIT = 24;
/** 動かしてからこれだけたったら自動で保存する */
const AUTOSAVE_MS = 1200;

const TABS: Array<{ id: Tab; label: string; empty: string }> = [
  { id: "item", label: "アイテム", empty: "この種類の取得済みアイテムはまだありません" },
  { id: "photo", label: "写真", empty: "おでかけ記録に写真を登録すると、額に入れて飾れます" },
  { id: "trophy", label: "トロフィー", empty: "おさんぽフレンチーで遊ぶと、道ごとのトロフィーがもらえます" },
  { id: "souvenir", label: "おみやげ", empty: "おでかけを記録した都道府県のペナントがもらえます" },
];

const ITEM_FILTERS: Array<{ id: ItemFilter; label: string }> = [
  { id: "all", label: "すべて" },
  { id: "toy", label: "おもちゃ" },
  { id: "food", label: "食べもの" },
  { id: "interior", label: "インテリア" },
  { id: "sushi", label: "寿司" },
  { id: "other", label: "その他" },
];

const RARITY_STYLE: Record<GachaRarity, string> = {
  N: "bg-[#71a95c]",
  R: "bg-[#659ed0]",
  SR: "bg-[#b38dd5]",
  SSR: "bg-[#d9a332]",
  UR: "bg-[#d9627e]",
  LR: "bg-[#70589d]",
  MR: "bg-gradient-to-r from-[#5b49a7] via-[#8274e0] to-[#34a9bd]",
};

function newId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `decor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const clamp = clampNumber;

function readLegacyPlacements(validIds: ReadonlySet<string>): Placement[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? parsePlacements(JSON.parse(raw), validIds) : [];
  } catch {
    return [];
  }
}

export function DecorationRoom({
  entries,
  initialPlacements,
  serverReady,
  totalCollectionCount,
  coinBalance,
}: {
  entries: DecorEntry[];
  /** サーバーに保存してある置き方（まだ無ければ null） */
  initialPlacements: Placement[] | null;
  /** サーバーに保存できるか（できなければ端末に保存する） */
  serverReady: boolean;
  totalCollectionCount: number;
  coinBalance: number;
}) {
  const validIds = useMemo(() => new Set(entries.map((entry) => entry.key)), [entries]);
  const entryByKey = useMemo(() => new Map(entries.map((entry) => [entry.key, entry])), [entries]);
  const [placements, setPlacements] = useState<Placement[]>(() => (initialPlacements ?? []).filter((p) => validIds.has(p.itemId)));
  const [past, setPast] = useState<Placement[][]>([]);
  const [future, setFuture] = useState<Placement[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("item");
  const [filter, setFilter] = useState<ItemFilter>("all");
  const [saveState, setSaveState] = useState<SaveState>(serverReady ? "saved" : "local");
  const [notice, setNotice] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; before: Placement[] } | null>(null);
  const saveTimer = useRef<number | null>(null);
  const latest = useRef(placements);
  latest.current = placements;

  // まだサーバーに置き方が無いときは、端末に残っている以前の置き方を引き継ぐ
  useEffect(() => {
    if (initialPlacements !== null) return;
    const legacy = readLegacyPlacements(validIds);
    if (legacy.length) { setPlacements(legacy); if (serverReady) setSaveState("dirty"); }
  }, [initialPlacements, serverReady, validIds]);

  const flash = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 1800);
  }, []);

  const persist = useCallback(async () => {
    const snapshot = latest.current;
    if (!serverReady) {
      try { window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(snapshot)); setSaveState("local"); } catch { setSaveState("error"); }
      return;
    }
    setSaveState("saving");
    try {
      const response = await fetch("/api/room", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placements: snapshot }) });
      if (!response.ok) throw new Error("save failed");
      const payload = (await response.json().catch(() => null)) as { ready?: boolean } | null;
      if (payload?.ready === false) { window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(snapshot)); setSaveState("local"); return; }
      setSaveState(latest.current === snapshot ? "saved" : "dirty");
    } catch {
      setSaveState("error");
    }
  }, [serverReady]);

  // 動かしたら少し待って自動で保存する
  useEffect(() => {
    if (saveState !== "dirty") return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void persist(); }, AUTOSAVE_MS);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [placements, saveState, persist]);

  // 自動保存の前にページを離れても、動かした分を送っておく
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;
  useEffect(() => {
    if (!serverReady) return;
    const flush = () => {
      if (saveStateRef.current !== "dirty") return;
      saveStateRef.current = "saving";
      void fetch("/api/room", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placements: latest.current }), keepalive: true });
    };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [serverReady]);

  const markDirty = useCallback(() => setSaveState((state) => (state === "local" && !serverReady ? "local" : "dirty")), [serverReady]);
  // 端末に保存するときも、動かしたら自動で保存する
  useEffect(() => {
    if (serverReady) return;
    try { window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(placements)); } catch { /* 保存できない端末 */ }
  }, [placements, serverReady]);

  const tabEntries = useMemo(() => entries.filter((entry) => {
    if (entry.kind !== tab) return false;
    if (entry.kind !== "item" || filter === "all") return true;
    if (filter === "sushi") return entry.series === "sushi";
    return entry.category === filter;
  }), [entries, filter, tab]);
  const itemCount = useMemo(() => entries.filter((entry) => entry.kind === "item").length, [entries]);
  const kindCount = useCallback((kind: Tab) => entries.filter((entry) => entry.kind === kind).length, [entries]);

  const selected = placements.find((item) => item.instanceId === selectedId) ?? null;

  const apply = useCallback((next: Placement[]) => {
    setPast((current) => [...current.slice(-(HISTORY_LIMIT - 1)), placements]);
    setFuture([]);
    setPlacements(next);
    markDirty();
  }, [markDirty, placements]);

  const changeSelected = useCallback((change: (item: Placement) => Placement) => {
    if (!selectedId) return;
    apply(placements.map((item) => item.instanceId === selectedId ? change(item) : item));
  }, [apply, placements, selectedId]);

  const addItem = useCallback((entry: DecorEntry) => {
    const alreadyPlaced = placements.filter((placed) => placed.itemId === entry.key);
    if (alreadyPlaced.length >= entry.count) {
      setSelectedId(alreadyPlaced[0]?.instanceId ?? null);
      flash(entry.count > 1 ? "持っている数だけ置いています" : "もう置いています");
      return;
    }
    if (placements.length >= ROOM_MAX_PLACEMENTS) { flash(`置けるのは${ROOM_MAX_PLACEMENTS}こまでです`); return; }
    const instanceId = newId();
    // 写真とペナントは壁に、ほかは床に。重ならないよう、置いた数に応じて少しずつずらす
    const onWall = entry.kind === "photo" || entry.kind === "souvenir";
    const n = placements.length;
    apply([...placements, {
      instanceId,
      itemId: entry.key,
      x: 16 + ((n * 29) % 68),
      y: onWall ? 22 + ((n * 13) % 18) : 58 + ((n * 11) % 24),
      scale: 1,
      rotation: 0,
      flipped: false,
      z: Math.max(0, ...placements.map((placed) => placed.z)) + 1,
    }]);
    setSelectedId(instanceId);
  }, [apply, flash, placements]);

  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((current) => [placements, ...current].slice(0, HISTORY_LIMIT));
    setPast((current) => current.slice(0, -1));
    setPlacements(previous);
    setSelectedId(null);
    markDirty();
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setPast((current) => [...current, placements].slice(-HISTORY_LIMIT));
    setFuture((current) => current.slice(1));
    setPlacements(next);
    setSelectedId(null);
    markDirty();
  }

  const saveLabel = saveState === "saving" ? "保存中…" : saveState === "dirty" ? "保存する" : saveState === "error" ? "もう一度保存" : saveState === "local" ? "この端末に保存" : "保存済み";

  return (
    <main className="min-h-dvh bg-paper pb-[calc(env(safe-area-inset-bottom)+1rem)] text-ink">
      <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-2 px-3">
          <Link href="/mypage" aria-label="マイページへ戻る" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-paper-deep">
            <IconChevronLeft size={25} />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-bold tracking-[0.18em] text-leaf-deep">MY ROOM</p>
            <h1 className="text-[18px] font-black">おへや</h1>
          </div>
          <button
            type="button"
            onClick={() => { if (saveTimer.current) window.clearTimeout(saveTimer.current); void persist(); }}
            disabled={saveState === "saving" || saveState === "saved"}
            className={`min-w-[78px] rounded-full px-3.5 py-2.5 text-xs font-bold shadow-sm active:scale-95 disabled:active:scale-100 ${saveState === "saved" || saveState === "local" ? "bg-paper-deep text-ink-soft" : saveState === "error" ? "bg-blossom-soft text-[#b94c60]" : "bg-leaf-deep text-white"}`}
          >
            {saveLabel}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-lg">
        <section className="relative overflow-hidden border-b border-line bg-[#f5ead8]" aria-label="デコレーションエリア">
          <div className="absolute left-4 top-3 z-20 rounded-full border border-white/80 bg-white/88 px-3 py-1.5 text-[11px] font-bold text-leaf-deep shadow-sm backdrop-blur">
            {saveState === "local" ? "この端末に保存中" : saveState === "error" ? "保存できませんでした" : "自動で保存されます"}
          </div>
          <div className="absolute right-4 top-3 z-20 rounded-full border border-line bg-card/90 px-3 py-1.5 text-[10px] font-bold text-ink-soft shadow-sm">
            🪙 {coinBalance.toLocaleString("ja-JP")}
          </div>

          <div
            className="relative h-[47dvh] min-h-[350px] max-h-[510px] touch-none overflow-hidden"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) setSelectedId(null);
            }}
          >
            <div className="absolute inset-x-0 top-0 h-[54%] bg-[linear-gradient(180deg,#fffaf0_0%,#f7eddc_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-[46%] border-t-4 border-[#d9bb91] bg-[repeating-linear-gradient(90deg,#ead0a8_0,#ead0a8_46px,#dfc098_47px,#dfc098_49px)]" />
            <div className="absolute left-[7%] top-[18%] h-[26%] w-[23%] rounded-t-full border-[7px] border-[#d7b989] bg-[linear-gradient(#bfe3ef_0_58%,#b7cf9c_59%)] shadow-[0_4px_0_rgba(115,83,48,.12)]">
              <div className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-[#d7b989]" />
              <div className="absolute left-0 top-1/2 h-1 w-full bg-[#d7b989]" />
            </div>
            <div className="absolute right-[8%] top-[19%] h-[21%] w-[26%] rotate-2 rounded-md border-4 border-white bg-[#efe4c8] p-2 shadow-md">
              <div className="h-full w-full bg-[radial-gradient(circle_at_25%_40%,#d98969_0_5px,transparent_6px),radial-gradient(circle_at_70%_65%,#7fa568_0_5px,transparent_6px),linear-gradient(135deg,transparent_46%,#c9b99a_47%_51%,transparent_52%)] opacity-70" />
            </div>
            <div className="absolute bottom-[11%] left-1/2 h-[24%] w-[68%] -translate-x-1/2 rounded-[50%] border border-[#d9cdb6] bg-[#fffaf0]/75 shadow-inner" />

            {/* The dog is part of the room, while collection items remain independent layers. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/characters/default/sit.webp" alt="部屋にいるフレンチブルドッグ" className="pointer-events-none absolute bottom-[12%] left-[13%] z-[3] h-[31%] w-auto object-contain drop-shadow-[0_7px_5px_rgba(91,64,39,.18)]" />

            {placements.map((placement) => {
              const item = entryByKey.get(placement.itemId);
              if (!item) return null;
              const isSelected = placement.instanceId === selectedId;
              return (
                <div
                  key={placement.instanceId}
                  className={`absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 select-none touch-none ${isSelected ? "ring-2 ring-leaf ring-offset-2 ring-offset-transparent" : ""}`}
                  style={{
                    left: `${placement.x}%`,
                    top: `${placement.y}%`,
                    zIndex: placement.z + 4,
                    transform: `translate(-50%, -50%) rotate(${placement.rotation}deg) scale(${placement.scale}) scaleX(${placement.flipped ? -1 : 1})`,
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setSelectedId(placement.instanceId);
                    dragRef.current = { id: placement.instanceId, before: placements };
                  }}
                  onPointerMove={(event) => {
                    if (dragRef.current?.id !== placement.instanceId) return;
                    const room = event.currentTarget.parentElement?.getBoundingClientRect();
                    if (!room) return;
                    const x = clamp(((event.clientX - room.left) / room.width) * 100, 7, 93);
                    const y = clamp(((event.clientY - room.top) / room.height) * 100, 10, 90);
                    setPlacements((current) => current.map((entry) => entry.instanceId === placement.instanceId ? { ...entry, x, y } : entry));
                  }}
                  onPointerUp={() => {
                    const drag = dragRef.current;
                    if (!drag || drag.id !== placement.instanceId) return;
                    setPast((current) => [...current.slice(-(HISTORY_LIMIT - 1)), drag.before]);
                    setFuture([]);
                    dragRef.current = null;
                    markDirty();
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.name}を移動`}
                >
                  {item.kind === "item" || item.kind === "trophy" ? <span className="pointer-events-none absolute bottom-1 left-1/2 h-3 w-[70%] -translate-x-1/2 rounded-full bg-[#735e48]/15 blur-[2px]" /> : null}
                  <DecorVisual entry={item} />
                  {isSelected ? <SelectionHandles /> : null}
                </div>
              );
            })}

            {selected ? (
              <div className="absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-1.5 rounded-full border border-line bg-card/95 p-1.5 shadow-lg backdrop-blur" data-town-control="true">
                <ToolButton label="小さく" onClick={() => changeSelected((item) => ({ ...item, scale: clamp(item.scale - 0.12, 0.55, 1.8) }))}>−</ToolButton>
                <ToolButton label="大きく" onClick={() => changeSelected((item) => ({ ...item, scale: clamp(item.scale + 0.12, 0.55, 1.8) }))}>＋</ToolButton>
                <ToolButton label="回転" onClick={() => changeSelected((item) => ({ ...item, rotation: (item.rotation + 45) % 360 }))}>↻</ToolButton>
                <ToolButton label="左右反転" onClick={() => changeSelected((item) => ({ ...item, flipped: !item.flipped }))}>↔</ToolButton>
                <ToolButton label="一番前へ" onClick={() => changeSelected((item) => ({ ...item, z: Math.max(0, ...placements.map((placed) => placed.z)) + 1 }))}><IconLayers size={18} /></ToolButton>
                <ToolButton danger label="片づける" onClick={() => { apply(placements.filter((item) => item.instanceId !== selectedId)); setSelectedId(null); }}><IconTrash size={18} /></ToolButton>
              </div>
            ) : null}
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2 border-b border-line bg-paper-deep px-4 py-2.5">
          <ActionButton disabled={!past.length} onClick={undo} icon="↶" label="元に戻す" />
          <ActionButton disabled={!future.length} onClick={redo} icon="↷" label="やり直す" />
          <ActionButton disabled={!placements.length} onClick={() => { apply([]); setSelectedId(null); }} icon="⌂" label="全て片づける" />
        </div>

        <section className="rounded-t-[28px] bg-card px-4 pb-6 pt-3 shadow-[0_-8px_24px_rgba(93,80,58,.08)]">
          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-line-strong" />
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="tablist" aria-label="飾るものの種類">
            {TABS.map((option) => (
              <button key={option.id} type="button" role="tab" aria-selected={tab === option.id} onClick={() => setTab(option.id)} className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-black ${tab === option.id ? "bg-leaf-deep text-white" : "bg-paper-deep text-ink-soft"}`}>
                {option.label}<span className="ml-1 text-[10px] font-bold opacity-75">{kindCount(option.id)}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-[10px] font-semibold text-ink-faint">タップで置く・ドラッグで移動</p>
            {tab === "item" ? <p className="text-xs font-bold tabular-nums text-ink-soft">{itemCount} / {totalCollectionCount}</p> : null}
          </div>

          {tab === "item" ? (
            <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-2">
              {ITEM_FILTERS.map((option) => (
                <button key={option.id} type="button" onClick={() => setFilter(option.id)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold ${filter === option.id ? "border-leaf bg-leaf-soft text-leaf-deep" : "border-line bg-paper text-ink-soft"}`}>
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          {tabEntries.length ? (
            <div className="mt-2 grid grid-cols-3 gap-2.5">
              {tabEntries.map((entry) => {
                const placedCount = placements.filter((placed) => placed.itemId === entry.key).length;
                return (
                  <button key={entry.key} type="button" onClick={() => addItem(entry)} className={`relative min-w-0 rounded-2xl border bg-paper p-2 text-left shadow-sm transition active:scale-[.97] ${selected?.itemId === entry.key ? "border-leaf ring-2 ring-leaf/30" : "border-line"}`}>
                    {entry.kind === "item" ? <span className={`absolute left-1.5 top-1.5 z-10 rounded-full px-1.5 py-0.5 text-[9px] font-black text-white ${RARITY_STYLE[entry.rarity]}`}>{entry.rarity}</span> : null}
                    <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-card/90 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-ink-soft">{placedCount}/{entry.count}</span>
                    <span className="flex aspect-square items-center justify-center pt-2">
                      <span className="flex h-[82%] w-[82%] items-center justify-center"><DecorVisual entry={entry} thumb /></span>
                    </span>
                    <span className="block truncate text-center text-[10px] font-bold">{entry.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="my-8 rounded-2xl border border-dashed border-line-strong bg-paper px-4 py-8 text-center text-sm text-ink-soft">
              {TABS.find((option) => option.id === tab)?.empty}
            </div>
          )}
        </section>
      </div>

      {notice ? <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-xs font-bold text-white shadow-lg">{notice}</div> : null}
    </main>
  );
}

/** 置いたもの1つの見た目（図鑑アイテム・額縁の写真・トロフィー・ペナント） */
function DecorVisual({ entry, thumb = false }: { entry: DecorEntry; thumb?: boolean }) {
  if (entry.kind === "item") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={entry.image} alt={thumb ? "" : entry.name} draggable={false} className="pointer-events-none relative h-full w-full object-contain drop-shadow-[0_4px_3px_rgba(68,50,33,.16)]" />;
  }
  if (entry.kind === "photo") {
    return (
      <span className="pointer-events-none relative flex h-full w-full items-center justify-center">
        <span className="block w-full rounded-[3px] border-[5px] border-[#b98a57] bg-[#fffaf0] p-[3px] shadow-[0_4px_6px_rgba(68,50,33,.25)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={entry.image} alt={thumb ? "" : entry.name} draggable={false} className="block aspect-[4/3] w-full object-cover" />
        </span>
      </span>
    );
  }
  if (entry.kind === "trophy") {
    return (
      <svg viewBox="0 0 96 96" className="pointer-events-none relative h-full w-full drop-shadow-[0_4px_3px_rgba(68,50,33,.2)]" role={thumb ? undefined : "img"} aria-label={thumb ? undefined : `${entry.name} ランク${entry.rank}のトロフィー`}>
        <path d="M30 14h36v8c0 14-7 24-18 26-11-2-18-12-18-26z" fill={entry.color} stroke="rgba(60,40,20,.35)" strokeWidth="1.5" />
        <path d="M30 18h-8c0 9 5 15 11 16M66 18h8c0 9-5 15-11 16" fill="none" stroke={entry.color} strokeWidth="4" strokeLinecap="round" />
        <path d="M36 18c0 10 3 18 8 22" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="3" strokeLinecap="round" />
        <rect x="44" y="47" width="8" height="10" fill={entry.color} stroke="rgba(60,40,20,.35)" strokeWidth="1.2" />
        <rect x="32" y="56" width="32" height="7" rx="2" fill="#8a5a34" />
        <rect x="26" y="63" width="44" height="22" rx="3" fill="#6a4426" />
        <text x="48" y="37" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff" stroke="rgba(60,40,20,.45)" strokeWidth=".8">{entry.rank}</text>
        <text x="48" y="73" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#ffe7b8">{entry.name.replace(/^おさんぽ /, "")}</text>
        <text x="48" y="82" textAnchor="middle" fontSize="7" fontWeight="700" fill="#ffe7b8">{entry.score.toLocaleString("ja-JP")}点</text>
      </svg>
    );
  }
  const label = entry.name.replace(/(県|府|都)$/, "");
  return (
    <svg viewBox="0 0 96 96" className="pointer-events-none relative h-full w-full drop-shadow-[0_4px_3px_rgba(68,50,33,.2)]" role={thumb ? undefined : "img"} aria-label={thumb ? undefined : `${entry.name}のおみやげペナント`}>
      <rect x="8" y="22" width="4" height="56" rx="2" fill="#8a5a34" />
      <path d="M12 26 L90 48 L12 70 Z" fill={entry.color} stroke="rgba(255,255,255,.85)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 26 L90 48 L12 70" fill="none" stroke="#fff3cf" strokeWidth="1" strokeDasharray="3 3" transform="translate(4 0) scale(.95)" />
      <text x="26" y="54" textAnchor="middle" fontSize="16">{entry.emoji}</text>
      <text x="54" y="52.5" textAnchor="middle" fontSize={label.length > 3 ? 9 : 11} fontWeight="900" fill="#fff">{label}</text>
    </svg>
  );
}

function SelectionHandles() {
  return <>{["-left-1.5 -top-1.5", "-right-1.5 -top-1.5", "-bottom-1.5 -left-1.5", "-bottom-1.5 -right-1.5"].map((position) => <span key={position} className={`absolute h-3 w-3 rounded-[3px] border-2 border-leaf-deep bg-white ${position}`} />)}</>;
}

function ToolButton({ label, onClick, danger = false, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return <button type="button" aria-label={label} onPointerDown={(event) => event.stopPropagation()} onClick={onClick} className={`flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold active:scale-90 ${danger ? "bg-blossom-soft text-[#b94c60]" : "bg-paper-deep text-ink-soft"}`}>{children}</button>;
}

function ActionButton({ disabled, onClick, icon, label }: { disabled: boolean; onClick: () => void; icon: string; label: string }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-line bg-card px-2 text-[10px] font-bold text-ink-soft shadow-sm disabled:opacity-35 active:scale-[.97]"><span className="text-lg" aria-hidden>{icon}</span>{label}</button>;
}
