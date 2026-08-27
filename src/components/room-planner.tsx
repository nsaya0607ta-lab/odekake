"use client";

import Image from "next/image";
import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  CATEGORY_LABELS,
  COLLECTION_CATEGORIES,
  type CollectionCategory,
  type CollectionItem,
} from "@/lib/collection/items";
import type { RoomPlacement } from "@/lib/data/room";
import {
  clampRoomPosition,
  clampRoomScale,
  nextRoomRotation,
  placementsOverlap,
} from "@/lib/room";
import styles from "./room-planner.module.css";

type Props = {
  items: readonly CollectionItem[];
  initialPlacements: RoomPlacement[];
};

type Filter = "all" | CollectionCategory;
type DragState = { itemId: string; pointerId: number; previous: RoomPlacement };
type RoomItemStyle = CSSProperties & {
  "--room-left": string;
  "--room-top": string;
  "--room-item-scale": number;
  "--item-rotation": string;
};

const FILTERS: readonly Filter[] = ["all", ...COLLECTION_CATEGORIES];
const STARTING_SPOTS = [
  [0.25, 0.28], [0.5, 0.3], [0.75, 0.28],
  [0.2, 0.5], [0.4, 0.5], [0.6, 0.5], [0.8, 0.5],
  [0.27, 0.72], [0.5, 0.72], [0.73, 0.72],
] as const;

function placementStyle(placement: RoomPlacement): RoomItemStyle {
  const widthAtDepth = 0.7 + placement.y * 0.3;
  const left = 50 + (placement.x - 0.5) * 100 * widthAtDepth;
  return {
    "--room-left": `${left}%`,
    "--room-top": `${placement.y * 100}%`,
    "--room-item-scale": (0.72 + placement.y * 0.34) * placement.scale,
    "--item-rotation": `${placement.rotation}deg`,
    zIndex: 10 + Math.round(placement.y * 100) + placement.zIndex,
  };
}

function filterLabel(filter: Filter) {
  return filter === "all" ? "すべて" : CATEGORY_LABELS[filter];
}

export function RoomPlanner({ items, initialPlacements }: Props) {
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const validInitial = useMemo(
    () => initialPlacements.filter((placement) => itemMap.has(placement.itemId)),
    [initialPlacements, itemMap],
  );
  const [placements, setPlacementsState] = useState(validInitial);
  const placementsRef = useRef(validInitial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [invalidId, setInvalidId] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("家具をタップして、好きな場所へ動かせます");
  const floorRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const setPlacements = (next: RoomPlacement[] | ((current: RoomPlacement[]) => RoomPlacement[])) => {
    setPlacementsState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      placementsRef.current = value;
      return value;
    });
  };

  const visibleItems = useMemo(
    () => items.filter((item) => filter === "all" || item.category === filter),
    [filter, items],
  );
  const selected = selectedId ? placements.find((placement) => placement.itemId === selectedId) ?? null : null;
  const selectedItem = selectedId ? itemMap.get(selectedId) ?? null : null;

  function overlaps(candidate: RoomPlacement) {
    const candidateItem = itemMap.get(candidate.itemId);
    if (!candidateItem) return false;
    return placementsRef.current.some((placement) => {
      if (placement.itemId === candidate.itemId) return false;
      const item = itemMap.get(placement.itemId);
      return item ? placementsOverlap(candidate, candidateItem, placement, item) : false;
    });
  }

  async function savePlacement(placement: RoomPlacement, previous: RoomPlacement | null) {
    setSavingIds((current) => new Set(current).add(placement.itemId));
    try {
      const response = await fetch("/api/room", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(placement),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "配置を保存できませんでした。");
      setMessage("配置を保存しました");
    } catch (error) {
      setPlacements((current) => {
        const withoutItem = current.filter((entry) => entry.itemId !== placement.itemId);
        return previous ? [...withoutItem, previous] : withoutItem;
      });
      setMessage(error instanceof Error ? error.message : "配置を保存できませんでした。");
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(placement.itemId);
        return next;
      });
    }
  }

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, placement: RoomPlacement) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { itemId: placement.itemId, pointerId: event.pointerId, previous: placement };
    setSelectedId(placement.itemId);
    setDraggingId(placement.itemId);
    setMessage("指を離すと、この場所に保存します");
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const floor = floorRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !floor) return;

    const rect = floor.getBoundingClientRect();
    const y = clampRoomPosition((event.clientY - rect.top) / rect.height);
    const widthAtDepth = 0.7 + y * 0.3;
    const x = clampRoomPosition(
      0.5 + (event.clientX - (rect.left + rect.width / 2)) / (rect.width * widthAtDepth),
    );
    const current = placementsRef.current.find((entry) => entry.itemId === drag.itemId);
    if (!current) return;
    const candidate = { ...current, x, y };
    setInvalidId(overlaps(candidate) ? candidate.itemId : null);
    setPlacements((entries) => entries.map((entry) => (entry.itemId === candidate.itemId ? candidate : entry)));
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const current = placementsRef.current.find((entry) => entry.itemId === drag.itemId);
    const invalid = current ? overlaps(current) : true;
    dragRef.current = null;
    setDraggingId(null);
    setInvalidId(null);
    if (!current) return;
    if (invalid) {
      setPlacements((entries) => entries.map((entry) => (entry.itemId === drag.itemId ? drag.previous : entry)));
      setMessage("家具が重なっています。少し離して置いてください");
      return;
    }
    void savePlacement(current, drag.previous);
  }

  function cancelDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDraggingId(null);
    setInvalidId(null);
    setPlacements((entries) => entries.map((entry) => (entry.itemId === drag.itemId ? drag.previous : entry)));
  }

  function placeItem(item: CollectionItem) {
    const existing = placementsRef.current.find((placement) => placement.itemId === item.id);
    if (existing) {
      setSelectedId(item.id);
      setMessage("すでに置いてあります。部屋の家具を動かせます");
      return;
    }
    const nextZ = Math.min(1000, placementsRef.current.length + 1);
    const candidate = STARTING_SPOTS.map(([x, y]) => ({ itemId: item.id, x, y, rotation: 0 as const, scale: 1, zIndex: nextZ }))
      .find((placement) => !overlaps(placement));
    if (!candidate) {
      setMessage("置ける場所がありません。家具を動かすか片づけてください");
      return;
    }
    setPlacements((current) => [...current, candidate]);
    setSelectedId(item.id);
    void savePlacement(candidate, null);
  }

  function updateSelected(transform: (placement: RoomPlacement) => RoomPlacement) {
    if (!selected) return;
    const candidate = transform(selected);
    if (overlaps(candidate)) {
      setMessage("ほかの家具と重なるため変更できません");
      return;
    }
    setPlacements((current) => current.map((entry) => (entry.itemId === selected.itemId ? candidate : entry)));
    void savePlacement(candidate, selected);
  }

  async function removeSelected() {
    if (!selected) return;
    const previous = selected;
    setPlacements((current) => current.filter((entry) => entry.itemId !== selected.itemId));
    setSelectedId(null);
    try {
      const response = await fetch("/api/room", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selected.itemId }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "片づけられませんでした。");
      setMessage("アイテムを一覧へ片づけました");
    } catch (error) {
      setPlacements((current) => [...current, previous]);
      setSelectedId(previous.itemId);
      setMessage(error instanceof Error ? error.message : "片づけられませんでした。");
    }
  }

  return (
    <div className={styles.planner}>
      <section className={styles.roomCard} aria-label="家具を配置する部屋">
        <div className={styles.roomHeading}>
          <div>
            <p className={styles.eyebrow}>ROOM LAYOUT</p>
            <h2>お部屋づくり</h2>
          </div>
          <span className={styles.saveState} aria-live="polite">
            <span className={savingIds.size ? styles.savingDot : styles.savedDot} />
            {savingIds.size ? "保存中" : "自動保存"}
          </span>
        </div>

        <div className={styles.scene}>
          <div className={styles.backWall} aria-hidden="true">
            <div className={styles.picture}>⌂</div>
            <div className={styles.window}><span /></div>
            <div className={styles.garland}>◆　◆　◆　◆　◆</div>
          </div>
          <div className={styles.leftWall} aria-hidden="true" />
          <div className={styles.rightWall} aria-hidden="true" />
          <div className={styles.floor} aria-hidden="true" />
          <div className={styles.floorHit} ref={floorRef}>
            {placements.map((placement) => {
              const item = itemMap.get(placement.itemId);
              if (!item?.image) return null;
              const isSelected = selectedId === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`${styles.placedItem} ${isSelected ? styles.selected : ""} ${draggingId === item.id ? styles.dragging : ""} ${invalidId === item.id ? styles.invalid : ""}`}
                  style={placementStyle(placement)}
                  onPointerDown={(event) => startDrag(event, placement)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={cancelDrag}
                  aria-label={`${item.name}を動かす`}
                  aria-pressed={isSelected}
                >
                  <span className={styles.itemShadow} />
                  <Image src={item.image} alt="" width={128} height={128} draggable={false} priority={false} />
                </button>
              );
            })}
            {placements.length === 0 ? (
              <div className={styles.emptyRoom}>
                <span>＋</span>
                下の一覧から家具を置いてみよう
              </div>
            ) : null}
          </div>
        </div>

        <p className={styles.guide} aria-live="polite">{message}</p>

        {selected && selectedItem ? (
          <div className={styles.controls} aria-label={`${selectedItem.name}の編集`}>
            <div className={styles.selectedName}>
              <small>選択中</small>
              <strong>{selectedItem.name}</strong>
            </div>
            <button type="button" onClick={() => updateSelected((entry) => ({ ...entry, rotation: nextRoomRotation(entry.rotation, -1) }))} aria-label="左に回転">↶<small>回転</small></button>
            <button type="button" onClick={() => updateSelected((entry) => ({ ...entry, rotation: nextRoomRotation(entry.rotation, 1) }))} aria-label="右に回転">↷<small>回転</small></button>
            <button type="button" onClick={() => updateSelected((entry) => ({ ...entry, scale: clampRoomScale(entry.scale - 0.1) }))} aria-label="小さくする">−<small>縮小</small></button>
            <button type="button" onClick={() => updateSelected((entry) => ({ ...entry, scale: clampRoomScale(entry.scale + 0.1) }))} aria-label="大きくする">＋<small>拡大</small></button>
            <button type="button" className={styles.removeButton} onClick={() => void removeSelected()} aria-label="部屋から片づける">×<small>片づける</small></button>
          </div>
        ) : null}
      </section>

      <section className={styles.inventory} aria-labelledby="room-inventory-title">
        <div className={styles.inventoryHeading}>
          <div>
            <p className={styles.eyebrow}>MY ITEMS</p>
            <h2 id="room-inventory-title">家具・小物</h2>
          </div>
          <span>{placements.length} / {items.length} 配置中</span>
        </div>
        <div className={styles.filters} aria-label="アイテムの種類">
          {FILTERS.map((entry) => (
            <button type="button" key={entry} className={filter === entry ? styles.activeFilter : ""} onClick={() => setFilter(entry)}>{filterLabel(entry)}</button>
          ))}
        </div>
        {visibleItems.length ? (
          <div className={styles.itemRail}>
            {visibleItems.map((item) => {
              const isPlaced = placements.some((entry) => entry.itemId === item.id);
              return (
                <button type="button" key={item.id} className={`${styles.inventoryItem} ${isPlaced ? styles.inventoryPlaced : ""}`} onClick={() => placeItem(item)} aria-label={`${item.name}${isPlaced ? "（配置中）" : "を部屋に置く"}`}>
                  <span className={styles.inventoryArt}>
                    {item.image ? <Image src={item.image} alt="" width={76} height={76} /> : null}
                    <em>{item.rarity}</em>
                    {isPlaced ? <i>配置中</i> : null}
                  </span>
                  <span>{item.name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyInventory}>この種類のアイテムはまだ持っていません</div>
        )}
      </section>
    </div>
  );
}
