"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconChevronLeft, IconLayers, IconTrash } from "@/components/icons";
import type { CollectionCategory } from "@/lib/collection/items";
import type { GachaRarity } from "@/lib/gacha/config";

export type DecorationInventoryItem = {
  id: string;
  name: string;
  image: string;
  category: CollectionCategory;
  series: string | null;
  rarity: GachaRarity;
  count: number;
};

type Placement = {
  instanceId: string;
  itemId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipped: boolean;
  z: number;
};

type Filter = "all" | CollectionCategory | "sushi";

const STORAGE_KEY = "odekake-decoration-room-v1";
const HISTORY_LIMIT = 24;

const FILTERS: Array<{ id: Filter; label: string }> = [
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseStoredPlacements(value: string | null, validIds: ReadonlySet<string>): Placement[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): Placement[] => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Partial<Placement>;
      if (typeof item.instanceId !== "string" || typeof item.itemId !== "string" || !validIds.has(item.itemId)) return [];
      if (typeof item.x !== "number" || typeof item.y !== "number") return [];
      return [{
        instanceId: item.instanceId,
        itemId: item.itemId,
        x: clamp(item.x, 6, 94),
        y: clamp(item.y, 10, 90),
        scale: clamp(typeof item.scale === "number" ? item.scale : 1, 0.55, 1.8),
        rotation: typeof item.rotation === "number" ? item.rotation : 0,
        flipped: item.flipped === true,
        z: typeof item.z === "number" ? item.z : 1,
      }];
    });
  } catch {
    return [];
  }
}

export function DecorationRoom({
  items,
  totalCollectionCount,
  coinBalance,
}: {
  items: DecorationInventoryItem[];
  totalCollectionCount: number;
  coinBalance: number;
}) {
  const validIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [past, setPast] = useState<Placement[][]>([]);
  const [future, setFuture] = useState<Placement[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; before: Placement[] } | null>(null);

  useEffect(() => {
    setPlacements(parseStoredPlacements(window.localStorage.getItem(STORAGE_KEY), validIds));
  }, [validIds]);

  const filteredItems = useMemo(() => items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "sushi") return item.series === "sushi";
    return item.category === filter;
  }), [filter, items]);

  const selected = placements.find((item) => item.instanceId === selectedId) ?? null;

  const apply = useCallback((next: Placement[]) => {
    setPast((current) => [...current.slice(-(HISTORY_LIMIT - 1)), placements]);
    setFuture([]);
    setPlacements(next);
    setSaved(false);
  }, [placements]);

  const changeSelected = useCallback((change: (item: Placement) => Placement) => {
    if (!selectedId) return;
    apply(placements.map((item) => item.instanceId === selectedId ? change(item) : item));
  }, [apply, placements, selectedId]);

  const addItem = useCallback((item: DecorationInventoryItem) => {
    const alreadyPlaced = placements.filter((placed) => placed.itemId === item.id);
    if (alreadyPlaced.length >= item.count) {
      setSelectedId(alreadyPlaced[0]?.instanceId ?? null);
      setNotice("所持数分をすでに置いています");
      window.setTimeout(() => setNotice(null), 1800);
      return;
    }
    const instanceId = newId();
    const offset = (placements.length % 5) * 3;
    apply([...placements, {
      instanceId,
      itemId: item.id,
      x: clamp(50 + offset, 12, 88),
      y: clamp(58 + offset / 2, 18, 86),
      scale: 1,
      rotation: 0,
      flipped: false,
      z: Math.max(0, ...placements.map((placed) => placed.z)) + 1,
    }]);
    setSelectedId(instanceId);
  }, [apply, placements]);

  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((current) => [placements, ...current].slice(0, HISTORY_LIMIT));
    setPast((current) => current.slice(0, -1));
    setPlacements(previous);
    setSelectedId(null);
    setSaved(false);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setPast((current) => [...current, placements].slice(-HISTORY_LIMIT));
    setFuture((current) => current.slice(1));
    setPlacements(next);
    setSelectedId(null);
    setSaved(false);
  }

  function save() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(placements));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <main className="min-h-dvh bg-paper pb-[calc(env(safe-area-inset-bottom)+1rem)] text-ink">
      <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-2 px-3">
          <Link href="/home" aria-label="ホームへ戻る" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-paper-deep">
            <IconChevronLeft size={25} />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-bold tracking-[0.18em] text-leaf-deep">MY DECORATION</p>
            <h1 className="text-[18px] font-black">わんこタウン</h1>
          </div>
          <button type="button" onClick={save} className="min-w-[66px] rounded-full bg-leaf-deep px-4 py-2.5 text-sm font-bold text-white shadow-sm active:scale-95">
            {saved ? "保存済み" : "保存"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-lg">
        <section className="relative overflow-hidden border-b border-line bg-[#f5ead8]" aria-label="デコレーションエリア">
          <div className="absolute left-4 top-3 z-20 rounded-full border border-white/80 bg-white/88 px-3 py-1.5 text-[11px] font-bold text-leaf-deep shadow-sm backdrop-blur">
            ✎ 編集中
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
              const item = itemById.get(placement.itemId);
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
                    setSaved(false);
                  }}
                  onPointerUp={() => {
                    const drag = dragRef.current;
                    if (!drag || drag.id !== placement.instanceId) return;
                    setPast((current) => [...current.slice(-(HISTORY_LIMIT - 1)), drag.before]);
                    setFuture([]);
                    dragRef.current = null;
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.name}を移動`}
                >
                  <span className="pointer-events-none absolute bottom-1 left-1/2 h-3 w-[70%] -translate-x-1/2 rounded-full bg-[#735e48]/15 blur-[2px]" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image} alt={item.name} draggable={false} className="pointer-events-none relative h-full w-full object-contain drop-shadow-[0_4px_3px_rgba(68,50,33,.16)]" />
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
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">持っているアイテム</h2>
              <p className="mt-0.5 text-[10px] font-semibold text-ink-faint">タップで置く・長押しで移動</p>
            </div>
            <p className="text-xs font-bold tabular-nums text-ink-soft">{items.length} / {totalCollectionCount}</p>
          </div>

          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2">
            {FILTERS.map((option) => (
              <button key={option.id} type="button" onClick={() => setFilter(option.id)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold ${filter === option.id ? "border-leaf bg-leaf-soft text-leaf-deep" : "border-line bg-paper text-ink-soft"}`}>
                {option.label}
              </button>
            ))}
          </div>

          {filteredItems.length ? (
            <div className="mt-2 grid grid-cols-3 gap-2.5">
              {filteredItems.map((item) => {
                const placedCount = placements.filter((placed) => placed.itemId === item.id).length;
                return (
                  <button key={item.id} type="button" onClick={() => addItem(item)} className={`relative min-w-0 rounded-2xl border bg-paper p-2 text-left shadow-sm transition active:scale-[.97] ${selected?.itemId === item.id ? "border-leaf ring-2 ring-leaf/30" : "border-line"}`}>
                    <span className={`absolute left-1.5 top-1.5 z-10 rounded-full px-1.5 py-0.5 text-[9px] font-black text-white ${RARITY_STYLE[item.rarity]}`}>{item.rarity}</span>
                    <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-card/90 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-ink-soft">{placedCount}/{item.count}</span>
                    <span className="flex aspect-square items-center justify-center pt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image} alt="" className="h-[78%] w-[78%] object-contain drop-shadow-[0_3px_2px_rgba(68,50,33,.14)]" />
                    </span>
                    <span className="block truncate text-center text-[10px] font-bold">{item.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="my-8 rounded-2xl border border-dashed border-line-strong bg-paper px-4 py-8 text-center text-sm text-ink-soft">
              この種類の取得済みアイテムはまだありません
            </div>
          )}
        </section>
      </div>

      {notice ? <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-xs font-bold text-white shadow-lg">{notice}</div> : null}
    </main>
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
