"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconChevronLeft, IconLayers, IconTrash } from "@/components/icons";
import type { CollectionCategory } from "@/lib/collection/items";
import type { GachaRarity } from "@/lib/gacha/config";

export type DecorationInventoryItem = {
  id: string; name: string; image: string; category: CollectionCategory;
  series: string | null; rarity: GachaRarity; count: number;
};
type Placement = {
  instanceId: string; itemId: string; x: number; y: number; scale: number;
  rotation: number; flipped: boolean; z: number;
};
type Room = { id: string; name: string; backgroundImage: string | null; placements: Placement[] };
type Filter = "all" | CollectionCategory | "sushi";

const STORAGE_KEY = "odekake-decoration-rooms-v2";
const LEGACY_STORAGE_KEY = "odekake-decoration-room-v1";
const DOG_ITEM_ID = "__room_dog__";
const HISTORY_LIMIT = 24;
const MAX_ROOMS = 5;
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "すべて" }, { id: "toy", label: "おもちゃ" },
  { id: "food", label: "食べもの" }, { id: "interior", label: "インテリア" },
  { id: "sushi", label: "寿司" }, { id: "other", label: "その他" },
];
const RARITY_STYLE: Record<GachaRarity, string> = {
  N: "bg-[#71a95c]", R: "bg-[#659ed0]", SR: "bg-[#b38dd5]",
  SSR: "bg-[#d9a332]", UR: "bg-[#d9627e]", LR: "bg-[#70589d]",
  MR: "bg-gradient-to-r from-[#5b49a7] via-[#8274e0] to-[#34a9bd]",
};

function newId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID() : `decor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
function createDogPlacement(): Placement {
  return { instanceId: `dog-${newId()}`, itemId: DOG_ITEM_ID, x: 28, y: 69, scale: 1.25, rotation: 0, flipped: false, z: 1 };
}
function createRoom(number: number): Room {
  return { id: newId(), name: `ルーム ${number}`, backgroundImage: null, placements: [createDogPlacement()] };
}
function parsePlacements(value: unknown, validIds: ReadonlySet<string>): Placement[] {
  if (!Array.isArray(value)) return [createDogPlacement()];
  const placements = value.flatMap((entry): Placement[] => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Partial<Placement>;
    if (typeof item.instanceId !== "string" || typeof item.itemId !== "string") return [];
    if (item.itemId !== DOG_ITEM_ID && !validIds.has(item.itemId)) return [];
    if (typeof item.x !== "number" || typeof item.y !== "number") return [];
    return [{
      instanceId: item.instanceId, itemId: item.itemId,
      x: clamp(item.x, 6, 94), y: clamp(item.y, 8, 92),
      scale: clamp(typeof item.scale === "number" ? item.scale : 1, .55, 1.8),
      rotation: typeof item.rotation === "number" ? item.rotation : 0,
      flipped: item.flipped === true, z: typeof item.z === "number" ? item.z : 1,
    }];
  });
  return placements.some((item) => item.itemId === DOG_ITEM_ID) ? placements : [createDogPlacement(), ...placements];
}
function loadRooms(validIds: ReadonlySet<string>): Room[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (Array.isArray(parsed)) {
      const rooms = parsed.slice(0, MAX_ROOMS).flatMap((entry, index): Room[] => {
        if (!entry || typeof entry !== "object") return [];
        const room = entry as Partial<Room>;
        return [{
          id: typeof room.id === "string" ? room.id : newId(),
          name: typeof room.name === "string" ? room.name : `ルーム ${index + 1}`,
          backgroundImage: typeof room.backgroundImage === "string" ? room.backgroundImage : null,
          placements: parsePlacements(room.placements, validIds),
        }];
      });
      if (rooms.length) return rooms;
    }
  } catch { /* Use the legacy room. */ }
  try {
    const legacy: unknown = JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY) ?? "null");
    if (Array.isArray(legacy)) return [{ ...createRoom(1), placements: parsePlacements(legacy, validIds) }];
  } catch { /* Use a new room. */ }
  return [createRoom(1)];
}
async function resizeBackground(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new window.Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("画像を読み込めませんでした"));
      nextImage.src = objectUrl;
    });
    const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像を加工できませんでした");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", .78);
  } finally { URL.revokeObjectURL(objectUrl); }
}

export function DecorationRoom({ items, totalCollectionCount, coinBalance }: {
  items: DecorationInventoryItem[]; totalCollectionCount: number; coinBalance: number;
}) {
  const validIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const itemById = useMemo(() => new Map<string, { name: string; image: string }>([
    ...items.map((item): [string, { name: string; image: string }] => [item.id, item]),
    [DOG_ITEM_ID, { name: "わんこ", image: "/characters/default/sit.webp" }],
  ]), [items]);
  const [rooms, setRooms] = useState<Room[]>(() => [createRoom(1)]);
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);
  const [past, setPast] = useState<Placement[][]>([]);
  const [future, setFuture] = useState<Placement[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const swipeRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);
  const dragRef = useRef<{
    id: string; before: Placement[]; element: HTMLDivElement; roomRect: DOMRect;
    offsetX: number; offsetY: number; latestX: number; latestY: number;
    moved: boolean; frame: number | null;
  } | null>(null);

  useEffect(() => { setRooms(loadRooms(validIds)); }, [validIds]);
  useEffect(() => () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    if (dragRef.current?.frame) window.cancelAnimationFrame(dragRef.current.frame);
  }, []);

  const activeRoom = rooms[activeRoomIndex] ?? rooms[0] ?? createRoom(1);
  const placements = activeRoom.placements;
  const selected = placements.find((item) => item.instanceId === selectedId) ?? null;
  const showNotice = useCallback((message: string) => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    setNotice(message);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 2200);
  }, []);
  const replaceActivePlacements = useCallback((next: Placement[]) => {
    setRooms((current) => current.map((room, index) => index === activeRoomIndex ? { ...room, placements: next } : room));
    setSaved(false);
  }, [activeRoomIndex]);
  const apply = useCallback((next: Placement[]) => {
    setPast((current) => [...current.slice(-(HISTORY_LIMIT - 1)), placements]);
    setFuture([]);
    replaceActivePlacements(next);
  }, [placements, replaceActivePlacements]);
  const changeSelected = useCallback((change: (item: Placement) => Placement) => {
    if (selectedId) apply(placements.map((item) => item.instanceId === selectedId ? change(item) : item));
  }, [apply, placements, selectedId]);
  const filteredItems = useMemo(() => items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "sushi") return item.series === "sushi";
    return item.category === filter;
  }), [filter, items]);
  const placedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    placements.forEach((placement) => {
      if (placement.itemId !== DOG_ITEM_ID) counts.set(placement.itemId, (counts.get(placement.itemId) ?? 0) + 1);
    });
    return counts;
  }, [placements]);
  const switchRoom = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= rooms.length || nextIndex === activeRoomIndex) return;
    setActiveRoomIndex(nextIndex); setSelectedId(null); setPast([]); setFuture([]);
  }, [activeRoomIndex, rooms.length]);
  const addItem = useCallback((item: DecorationInventoryItem) => {
    if ((placedCounts.get(item.id) ?? 0) >= item.count) {
      setSelectedId(placements.find((placed) => placed.itemId === item.id)?.instanceId ?? null);
      showNotice("所持数分をすでに置いています");
      return;
    }
    const instanceId = newId();
    const offset = (placements.length % 5) * 3;
    apply([...placements, {
      instanceId, itemId: item.id, x: clamp(50 + offset, 12, 88),
      y: clamp(58 + offset / 2, 18, 86), scale: 1, rotation: 0, flipped: false,
      z: Math.max(0, ...placements.map((placed) => placed.z)) + 1,
    }]);
    setSelectedId(instanceId);
  }, [apply, placedCounts, placements, showNotice]);

  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((current) => [placements, ...current].slice(0, HISTORY_LIMIT));
    setPast((current) => current.slice(0, -1)); replaceActivePlacements(previous); setSelectedId(null);
  }
  function redo() {
    const next = future[0];
    if (!next) return;
    setPast((current) => [...current, placements].slice(-HISTORY_LIMIT));
    setFuture((current) => current.slice(1)); replaceActivePlacements(next); setSelectedId(null);
  }
  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
      setSaved(true); showNotice("すべての部屋を保存しました");
    } catch { showNotice("保存容量を超えました。背景画像を小さくしてください"); }
  }
  function addRoom() {
    if (rooms.length >= MAX_ROOMS) { showNotice(`部屋は${MAX_ROOMS}個まで作れます`); return; }
    setRooms((current) => [...current, createRoom(current.length + 1)]);
    setActiveRoomIndex(rooms.length); setSelectedId(null); setPast([]); setFuture([]); setSaved(false);
  }
  function deleteRoom() {
    if (rooms.length === 1 || !window.confirm(`${activeRoom.name}を削除しますか？`)) return;
    const nextRooms = rooms.filter((_, index) => index !== activeRoomIndex)
      .map((room, index) => ({ ...room, name: `ルーム ${index + 1}` }));
    setRooms(nextRooms); setActiveRoomIndex(Math.min(activeRoomIndex, nextRooms.length - 1));
    setSelectedId(null); setPast([]); setFuture([]); setSaved(false);
  }
  async function chooseBackground(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { showNotice("画像ファイルを選んでください"); return; }
    if (file.size > 12 * 1024 * 1024) { showNotice("12MB以下の画像を選んでください"); return; }
    try {
      const backgroundImage = await resizeBackground(file);
      setRooms((current) => current.map((room, index) => index === activeRoomIndex ? { ...room, backgroundImage } : room));
      setSaved(false); showNotice("背景を変更しました。保存ボタンで確定できます");
    } catch { showNotice("この画像は読み込めませんでした"); }
  }
  function finishDrag(pointerId: number) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.frame) window.cancelAnimationFrame(drag.frame);
    if (drag.moved) {
      const next = drag.before.map((entry) => entry.instanceId === drag.id
        ? { ...entry, x: drag.latestX, y: drag.latestY } : entry);
      setPast((current) => [...current.slice(-(HISTORY_LIMIT - 1)), drag.before]);
      setFuture([]); replaceActivePlacements(next);
    }
    if (drag.element.hasPointerCapture(pointerId)) drag.element.releasePointerCapture(pointerId);
    dragRef.current = null;
  }

  return (
    <main className="min-h-dvh bg-paper pb-[calc(env(safe-area-inset-bottom)+1rem)] text-ink">
      <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-2 px-3">
          <Link href="/home" aria-label="ホームへ戻る" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-paper-deep"><IconChevronLeft size={25} /></Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-bold tracking-[0.18em] text-leaf-deep">MY DECORATION</p>
            <h1 className="text-[18px] font-black">わんこタウン</h1>
          </div>
          <button type="button" onClick={save} className="min-w-[66px] rounded-full bg-leaf-deep px-4 py-2.5 text-sm font-bold text-white shadow-sm active:scale-95">{saved ? "保存済み" : "保存"}</button>
        </div>
      </header>

      <div className="mx-auto max-w-lg">
        <section className="relative overflow-hidden border-b border-line bg-[#f5ead8]" aria-label="デコレーションエリア">
          <div className="flex h-12 items-center justify-between gap-2 border-b border-white/60 bg-card/75 px-3">
            <button type="button" onClick={() => switchRoom(activeRoomIndex - 1)} disabled={activeRoomIndex === 0} aria-label="前の部屋" className="h-9 w-9 rounded-full bg-white/85 text-xl font-bold text-ink-soft shadow-sm disabled:opacity-30">‹</button>
            <div className="min-w-0 text-center">
              <p className="text-xs font-black">{activeRoom.name}</p>
              <div className="mt-1 flex justify-center gap-1" aria-label={`${activeRoomIndex + 1}部屋目 / ${rooms.length}部屋`}>
                {rooms.map((room, index) => <span key={room.id} className={`h-1.5 rounded-full transition-all ${index === activeRoomIndex ? "w-4 bg-leaf-deep" : "w-1.5 bg-line-strong"}`} />)}
              </div>
            </div>
            <button type="button" onClick={() => switchRoom(activeRoomIndex + 1)} disabled={activeRoomIndex === rooms.length - 1} aria-label="次の部屋" className="h-9 w-9 rounded-full bg-white/85 text-xl font-bold text-ink-soft shadow-sm disabled:opacity-30">›</button>
            <button type="button" onClick={addRoom} disabled={rooms.length >= MAX_ROOMS} aria-label="部屋を追加" className="h-9 rounded-full bg-leaf-deep px-3 text-xs font-bold text-white shadow-sm disabled:opacity-35">＋ 部屋</button>
          </div>

          <div
            className="relative h-[47dvh] min-h-[350px] max-h-[510px] touch-none overflow-hidden bg-cover bg-center"
            style={activeRoom.backgroundImage ? { backgroundImage: `url(${activeRoom.backgroundImage})` } : undefined}
            onPointerDown={(event) => {
              if (event.target !== event.currentTarget) return;
              setSelectedId(null); event.currentTarget.setPointerCapture(event.pointerId);
              swipeRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
            }}
            onPointerUp={(event) => {
              const swipe = swipeRef.current; swipeRef.current = null;
              if (!swipe || swipe.pointerId !== event.pointerId) return;
              const deltaX = event.clientX - swipe.startX;
              const deltaY = event.clientY - swipe.startY;
              if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
                switchRoom(activeRoomIndex + (deltaX < 0 ? 1 : -1));
              }
            }}
            onPointerCancel={() => { swipeRef.current = null; }}
          >
            {!activeRoom.backgroundImage ? <DefaultRoomBackground /> : null}
            <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full border border-white/80 bg-white/88 px-3 py-1.5 text-[10px] font-bold text-leaf-deep shadow-sm backdrop-blur">✎ 編集中</div>
            <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border border-line bg-card/90 px-3 py-1.5 text-[10px] font-bold text-ink-soft shadow-sm">🪙 {coinBalance.toLocaleString("ja-JP")}</div>

            {placements.map((placement) => {
              const item = itemById.get(placement.itemId);
              if (!item) return null;
              const isSelected = placement.instanceId === selectedId;
              const isDog = placement.itemId === DOG_ITEM_ID;
              return (
                <div
                  key={placement.instanceId}
                  className={`absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 select-none touch-none ${isSelected ? "ring-2 ring-leaf ring-offset-2 ring-offset-transparent" : ""}`}
                  style={{ left: `${placement.x}%`, top: `${placement.y}%`, zIndex: placement.z + 4, transform: `translate(-50%, -50%) rotate(${placement.rotation}deg) scale(${placement.scale}) scaleX(${placement.flipped ? -1 : 1})` }}
                  onPointerDown={(event) => {
                    event.preventDefault(); event.stopPropagation();
                    const roomRect = event.currentTarget.parentElement?.getBoundingClientRect();
                    if (!roomRect) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    const pointerX = ((event.clientX - roomRect.left) / roomRect.width) * 100;
                    const pointerY = ((event.clientY - roomRect.top) / roomRect.height) * 100;
                    setSelectedId(placement.instanceId);
                    dragRef.current = {
                      id: placement.instanceId, before: placements, element: event.currentTarget, roomRect,
                      offsetX: pointerX - placement.x, offsetY: pointerY - placement.y,
                      latestX: placement.x, latestY: placement.y, moved: false, frame: null,
                    };
                  }}
                  onPointerMove={(event) => {
                    const drag = dragRef.current;
                    if (!drag || drag.id !== placement.instanceId) return;
                    const pointerX = ((event.clientX - drag.roomRect.left) / drag.roomRect.width) * 100;
                    const pointerY = ((event.clientY - drag.roomRect.top) / drag.roomRect.height) * 100;
                    drag.latestX = clamp(pointerX - drag.offsetX, 6, 94);
                    drag.latestY = clamp(pointerY - drag.offsetY, 8, 92);
                    drag.moved = true;
                    if (drag.frame === null) {
                      drag.frame = window.requestAnimationFrame(() => {
                        const current = dragRef.current;
                        if (!current || current.id !== placement.instanceId) return;
                        current.element.style.left = `${current.latestX}%`;
                        current.element.style.top = `${current.latestY}%`;
                        current.frame = null;
                      });
                    }
                  }}
                  onPointerUp={(event) => finishDrag(event.pointerId)}
                  onPointerCancel={(event) => finishDrag(event.pointerId)}
                  role="button" tabIndex={0} aria-label={`${item.name}を移動`}
                >
                  <span className="pointer-events-none absolute bottom-1 left-1/2 h-3 w-[70%] -translate-x-1/2 rounded-full bg-[#735e48]/15 blur-[2px]" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image} alt={item.name} draggable={false} className={`pointer-events-none relative h-full w-full object-contain drop-shadow-[0_4px_3px_rgba(68,50,33,.16)] ${isDog ? "scale-110" : ""}`} />
                  {isSelected ? <SelectionHandles /> : null}
                </div>
              );
            })}

            {selected ? (
              <div className="absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-1.5 rounded-full border border-line bg-card/95 p-1.5 shadow-lg backdrop-blur">
                <ToolButton label="小さく" onClick={() => changeSelected((item) => ({ ...item, scale: clamp(item.scale - .12, .55, 1.8) }))}>−</ToolButton>
                <ToolButton label="大きく" onClick={() => changeSelected((item) => ({ ...item, scale: clamp(item.scale + .12, .55, 1.8) }))}>＋</ToolButton>
                <ToolButton label="回転" onClick={() => changeSelected((item) => ({ ...item, rotation: (item.rotation + 45) % 360 }))}>↻</ToolButton>
                <ToolButton label="左右反転" onClick={() => changeSelected((item) => ({ ...item, flipped: !item.flipped }))}>↔</ToolButton>
                <ToolButton label="一番前へ" onClick={() => changeSelected((item) => ({ ...item, z: Math.max(0, ...placements.map((placed) => placed.z)) + 1 }))}><IconLayers size={18} /></ToolButton>
                {selected.itemId !== DOG_ITEM_ID ? <ToolButton danger label="片づける" onClick={() => { apply(placements.filter((item) => item.instanceId !== selectedId)); setSelectedId(null); }}><IconTrash size={18} /></ToolButton> : null}
              </div>
            ) : null}
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2 border-b border-line bg-paper-deep px-4 py-2.5">
          <ActionButton disabled={!past.length} onClick={undo} icon="↶" label="元に戻す" />
          <ActionButton disabled={!future.length} onClick={redo} icon="↷" label="やり直す" />
          <ActionButton disabled={placements.every((item) => item.itemId === DOG_ITEM_ID)} onClick={() => { apply(placements.filter((item) => item.itemId === DOG_ITEM_ID)); setSelectedId(null); }} icon="⌂" label="全て片づける" />
        </div>
        <div className="flex items-center gap-2 border-b border-line bg-card px-4 py-3">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { void chooseBackground(event.target.files?.[0]); event.currentTarget.value = ""; }} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-full bg-leaf-soft px-3.5 py-2 text-xs font-bold text-leaf-deep active:scale-[.97]">▧ 背景を変更</button>
          {activeRoom.backgroundImage ? <button type="button" onClick={() => { setRooms((current) => current.map((room, index) => index === activeRoomIndex ? { ...room, backgroundImage: null } : room)); setSaved(false); }} className="rounded-full border border-line px-3 py-2 text-xs font-bold text-ink-soft">標準に戻す</button> : null}
          <button type="button" disabled={rooms.length === 1} onClick={deleteRoom} className="ml-auto text-[10px] font-bold text-ink-faint disabled:hidden">部屋を削除</button>
          <p className="hidden text-right text-[9px] leading-tight text-ink-faint min-[390px]:block">推奨 1600×1500px<br />JPEG / WebP</p>
        </div>
        <p className="bg-card px-4 pb-2 text-center text-[9px] font-semibold text-ink-faint">背景を左右にスワイプして部屋を切り替え</p>

        <section className="rounded-t-[28px] bg-card px-4 pb-6 pt-3 shadow-[0_-8px_24px_rgba(93,80,58,.08)]">
          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-line-strong" />
          <div className="flex items-end justify-between gap-3">
            <div><h2 className="text-lg font-black">持っているアイテム</h2><p className="mt-0.5 text-[10px] font-semibold text-ink-faint">タップで置く・指でそのまま移動</p></div>
            <p className="text-xs font-bold tabular-nums text-ink-soft">{items.length} / {totalCollectionCount}</p>
          </div>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2">
            {FILTERS.map((option) => <button key={option.id} type="button" onClick={() => setFilter(option.id)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold ${filter === option.id ? "border-leaf bg-leaf-soft text-leaf-deep" : "border-line bg-paper text-ink-soft"}`}>{option.label}</button>)}
          </div>
          {filteredItems.length ? (
            <div className="mt-2 grid grid-cols-3 gap-2.5">
              {filteredItems.map((item) => {
                const placedCount = placedCounts.get(item.id) ?? 0;
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
          ) : <div className="my-8 rounded-2xl border border-dashed border-line-strong bg-paper px-4 py-8 text-center text-sm text-ink-soft">この種類の取得済みアイテムはまだありません</div>}
        </section>
      </div>
      {notice ? <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-xs font-bold text-white shadow-lg">{notice}</div> : null}
    </main>
  );
}

function DefaultRoomBackground() {
  return <div className="pointer-events-none absolute inset-0">
    <div className="absolute inset-x-0 top-0 h-[54%] bg-[linear-gradient(180deg,#fffaf0_0%,#f7eddc_100%)]" />
    <div className="absolute inset-x-0 bottom-0 h-[46%] border-t-4 border-[#d9bb91] bg-[repeating-linear-gradient(90deg,#ead0a8_0,#ead0a8_46px,#dfc098_47px,#dfc098_49px)]" />
    <div className="absolute left-[7%] top-[18%] h-[26%] w-[23%] rounded-t-full border-[7px] border-[#d7b989] bg-[linear-gradient(#bfe3ef_0_58%,#b7cf9c_59%)] shadow-[0_4px_0_rgba(115,83,48,.12)]">
      <div className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-[#d7b989]" /><div className="absolute left-0 top-1/2 h-1 w-full bg-[#d7b989]" />
    </div>
    <div className="absolute right-[8%] top-[19%] h-[21%] w-[26%] rotate-2 rounded-md border-4 border-white bg-[#efe4c8] p-2 shadow-md">
      <div className="h-full w-full bg-[radial-gradient(circle_at_25%_40%,#d98969_0_5px,transparent_6px),radial-gradient(circle_at_70%_65%,#7fa568_0_5px,transparent_6px),linear-gradient(135deg,transparent_46%,#c9b99a_47%_51%,transparent_52%)] opacity-70" />
    </div>
    <div className="absolute bottom-[11%] left-1/2 h-[24%] w-[68%] -translate-x-1/2 rounded-[50%] border border-[#d9cdb6] bg-[#fffaf0]/75 shadow-inner" />
  </div>;
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
