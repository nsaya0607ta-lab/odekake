"use client";

import Image from "next/image";
import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { CollectionItem } from "@/lib/collection/items";
import type { RoomPlacement } from "@/lib/data/room";
import {
  ROOM_GRID_SIZE,
  ROOM_POSITION_MAX,
  ROOM_POSITION_MIN,
  clampRoomScale,
  nextRoomRotation,
  placementsOverlap,
  snapRoomPosition,
} from "@/lib/room";
import styles from "./room-planner.module.css";

type Props = { items: readonly CollectionItem[]; initialPlacements: RoomPlacement[]; residentImage: string };
type RoomFilter = "all" | "furniture" | "table" | "chair" | "bed" | "rug" | "lighting" | "small" | "wall" | "other";
type DragState = { itemId: string; pointerId: number; previous: RoomPlacement };
type DraftState = { itemId: string; previous: RoomPlacement | null };
type Camera = { scale: number; x: number; y: number };
type Point = { x: number; y: number };
type CameraGesture = { camera: Camera; center: Point; distance: number };
type RoomItemStyle = CSSProperties & {
  "--room-left": string;
  "--room-top": string;
  "--room-item-scale": number;
  "--item-rotation": string;
};

const ROOM_FILTERS: readonly { id: RoomFilter; label: string }[] = [
  { id: "all", label: "すべて" }, { id: "furniture", label: "家具" },
  { id: "table", label: "テーブル" }, { id: "chair", label: "イス" },
  { id: "bed", label: "ベッド" }, { id: "rug", label: "ラグ" },
  { id: "lighting", label: "照明" }, { id: "small", label: "小物" },
  { id: "wall", label: "壁飾り" }, { id: "other", label: "その他" },
] as const;

const TABLE_HINTS = ["kotatsu", "table", "shooting_gallery"];
const CHAIR_HINTS = ["chair", "stool", "hammock", "sled"];
const BED_HINTS = ["bed", "blanket", "yutanpo", "kamakura"];
const RUG_HINTS = ["rug", "mat", "map", "sea_of_clouds"];
const LIGHT_HINTS = ["lantern", "campfire", "fireplace", "stove", "sparkler", "fireworks", "moon", "diamond_dust"];
const WALL_HINTS = ["wreath", "sudare", "icicle", "ornament", "milky_way", "sunrise"];

function includesHint(id: string, hints: readonly string[]) { return hints.some((hint) => id.includes(hint)); }

function roomFilterOf(item: CollectionItem): Exclude<RoomFilter, "all"> {
  if (includesHint(item.id, TABLE_HINTS)) return "table";
  if (includesHint(item.id, CHAIR_HINTS)) return "chair";
  if (includesHint(item.id, BED_HINTS)) return "bed";
  if (includesHint(item.id, RUG_HINTS)) return "rug";
  if (includesHint(item.id, LIGHT_HINTS)) return "lighting";
  if (includesHint(item.id, WALL_HINTS)) return "wall";
  if (item.category === "interior") return "furniture";
  if (item.category === "toy" || item.category === "food" || item.category === "accessory") return "small";
  return "other";
}

function placementStyle(placement: RoomPlacement): RoomItemStyle {
  const widthAtDepth = 0.7 + placement.y * 0.3;
  return {
    "--room-left": `${50 + (placement.x - 0.5) * 100 * widthAtDepth}%`,
    "--room-top": `${placement.y * 100}%`,
    "--room-item-scale": (0.72 + placement.y * 0.34) * placement.scale,
    "--item-rotation": `${placement.rotation}deg`,
    zIndex: 10 + Math.round(placement.y * 100) + placement.zIndex,
  };
}

function pointsCenter(points: readonly Point[]): Point {
  if (points.length === 1) return points[0] as Point;
  return { x: ((points[0]?.x ?? 0) + (points[1]?.x ?? 0)) / 2, y: ((points[0]?.y ?? 0) + (points[1]?.y ?? 0)) / 2 };
}

function pointsDistance(points: readonly Point[]) {
  if (points.length < 2) return 0;
  return Math.hypot((points[0]?.x ?? 0) - (points[1]?.x ?? 0), (points[0]?.y ?? 0) - (points[1]?.y ?? 0));
}

export function RoomPlanner({ items, initialPlacements, residentImage }: Props) {
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const validInitial = useMemo(() => initialPlacements.filter((placement) => itemMap.has(placement.itemId)), [initialPlacements, itemMap]);
  const [placements, setPlacementsState] = useState(validInitial);
  const placementsRef = useRef(validInitial);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraftState] = useState<DraftState | null>(null);
  const draftRef = useRef<DraftState | null>(null);
  const [filter, setFilter] = useState<RoomFilter>("all");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [invalidId, setInvalidId] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("模様替えを押すと、家具を動かせます");
  const [camera, setCamera] = useState<Camera>({ scale: 1, x: 0, y: 0 });
  const floorRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const cameraPointersRef = useRef(new Map<number, Point>());
  const cameraGestureRef = useRef<CameraGesture | null>(null);

  const setPlacements = (next: RoomPlacement[] | ((current: RoomPlacement[]) => RoomPlacement[])) => {
    setPlacementsState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      placementsRef.current = value;
      return value;
    });
  };
  const setDraft = (next: DraftState | null) => { draftRef.current = next; setDraftState(next); };

  const availableFilters = useMemo(
    () => ROOM_FILTERS.filter((entry) => entry.id === "all" || items.some((item) => roomFilterOf(item) === entry.id)),
    [items],
  );
  const visibleItems = useMemo(() => items.filter((item) => filter === "all" || roomFilterOf(item) === filter), [filter, items]);
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

  function beginDraft(placement: RoomPlacement, previous: RoomPlacement | null) {
    const active = draftRef.current;
    if (active && active.itemId !== placement.itemId) {
      setMessage("先に選択中の家具を配置するか、キャンセルしてください");
      return false;
    }
    if (!active) setDraft({ itemId: placement.itemId, previous });
    setSelectedId(placement.itemId);
    return true;
  }

  function cancelDraft(nextMessage = "変更をキャンセルしました") {
    const active = draftRef.current;
    if (!active) return;
    setPlacements((current) => {
      const withoutItem = current.filter((entry) => entry.itemId !== active.itemId);
      return active.previous ? [...withoutItem, active.previous] : withoutItem;
    });
    setDraft(null); setSelectedId(null); setInvalidId(null); setMessage(nextMessage);
  }

  async function savePlacement(placement: RoomPlacement, previous: RoomPlacement | null) {
    setSavingIds((current) => new Set(current).add(placement.itemId));
    try {
      const response = await fetch("/api/room", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(placement) });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "配置を保存できませんでした。");
      setMessage("家具を配置しました");
      return true;
    } catch (error) {
      setPlacements((current) => {
        const withoutItem = current.filter((entry) => entry.itemId !== placement.itemId);
        return previous ? [...withoutItem, previous] : withoutItem;
      });
      setMessage(error instanceof Error ? error.message : "配置を保存できませんでした。");
      return false;
    } finally {
      setSavingIds((current) => { const next = new Set(current); next.delete(placement.itemId); return next; });
    }
  }

  function toggleEditing() {
    if (isEditing) {
      if (draftRef.current) cancelDraft("未確定の変更を戻して、模様替えを終了しました");
      setIsEditing(false); setSelectedId(null); setMessage("完成したお部屋です");
      return;
    }
    setIsEditing(true); setCamera({ scale: 1, x: 0, y: 0 }); setMessage("家具をタップして選び、指で動かしてください");
  }

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, placement: RoomPlacement) {
    const previous = draftRef.current?.itemId === placement.itemId ? draftRef.current.previous : placement;
    if (!isEditing || !beginDraft(placement, previous)) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { itemId: placement.itemId, pointerId: event.pointerId, previous: placement };
    setDraggingId(placement.itemId); setMessage("指を離すと近くのマスに置かれます");
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current; const floor = floorRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !floor) return;
    const rect = floor.getBoundingClientRect();
    const y = snapRoomPosition((event.clientY - rect.top) / rect.height);
    const widthAtDepth = 0.7 + y * 0.3;
    const x = snapRoomPosition(0.5 + (event.clientX - (rect.left + rect.width / 2)) / (rect.width * widthAtDepth));
    const current = placementsRef.current.find((entry) => entry.itemId === drag.itemId);
    if (!current) return;
    const candidate = { ...current, x, y };
    setInvalidId(overlaps(candidate) ? candidate.itemId : null);
    setPlacements((entries) => entries.map((entry) => entry.itemId === candidate.itemId ? candidate : entry));
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const current = placementsRef.current.find((entry) => entry.itemId === drag.itemId);
    const invalid = current ? overlaps(current) : true;
    dragRef.current = null; setDraggingId(null); setInvalidId(null);
    if (!current) return;
    if (invalid) {
      setPlacements((entries) => entries.map((entry) => entry.itemId === drag.itemId ? drag.previous : entry));
      setMessage("家具が重なっています。緑のマスへ動かしてください"); return;
    }
    setMessage("この場所でよければ「配置」を押してください");
  }

  function cancelDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null; setDraggingId(null); setInvalidId(null);
    setPlacements((entries) => entries.map((entry) => entry.itemId === drag.itemId ? drag.previous : entry));
  }

  function findOpenPlacement(item: CollectionItem): RoomPlacement | null {
    const nextZ = Math.min(1000, placementsRef.current.length + 1);
    for (let row = 1; row < ROOM_GRID_SIZE; row += 1) {
      for (let column = 1; column < ROOM_GRID_SIZE - 1; column += 1) {
        const span = ROOM_POSITION_MAX - ROOM_POSITION_MIN;
        const candidate: RoomPlacement = { itemId: item.id, x: ROOM_POSITION_MIN + (span * column) / (ROOM_GRID_SIZE - 1), y: ROOM_POSITION_MIN + (span * row) / (ROOM_GRID_SIZE - 1), rotation: 0, scale: 1, zIndex: nextZ };
        if (!overlaps(candidate)) return candidate;
      }
    }
    return null;
  }

  function placeItem(item: CollectionItem) {
    const existing = placementsRef.current.find((placement) => placement.itemId === item.id);
    if (existing) { if (beginDraft(existing, existing)) setMessage("配置中の家具を選びました"); return; }
    if (draftRef.current) { setMessage("先に選択中の家具を配置するか、キャンセルしてください"); return; }
    const candidate = findOpenPlacement(item);
    if (!candidate) { setMessage("置けるマスがありません。家具を移動するか収納してください"); return; }
    setPlacements((current) => [...current, candidate]); beginDraft(candidate, null);
    setMessage("仮置きしました。位置を調整して「配置」を押してください");
  }

  function updateSelected(transform: (placement: RoomPlacement) => RoomPlacement) {
    if (!selected) return;
    const candidate = transform(selected);
    if (overlaps(candidate)) { setMessage("ほかの家具と重なるため変更できません"); return; }
    setPlacements((current) => current.map((entry) => entry.itemId === selected.itemId ? candidate : entry));
    setMessage("この状態でよければ「配置」を押してください");
  }

  async function commitSelected() {
    if (!selected || !draft || overlaps(selected)) return;
    await savePlacement(selected, draft.previous);
    setDraft(null); setSelectedId(null); setInvalidId(null);
  }

  async function removeSelected() {
    if (!selected || !draft) return;
    if (!draft.previous) {
      setPlacements((current) => current.filter((entry) => entry.itemId !== selected.itemId));
      setDraft(null); setSelectedId(null); setMessage("仮置きしたアイテムを一覧へ戻しました"); return;
    }
    const previous = draft.previous;
    setPlacements((current) => current.filter((entry) => entry.itemId !== selected.itemId));
    setDraft(null); setSelectedId(null);
    try {
      const response = await fetch("/api/room", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: selected.itemId }) });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "収納できませんでした。");
      setMessage("家具を収納しました");
    } catch (error) {
      setPlacements((current) => [...current, previous]);
      setMessage(error instanceof Error ? error.message : "収納できませんでした。");
    }
  }

  function beginCameraGesture() {
    const points = [...cameraPointersRef.current.values()];
    cameraGestureRef.current = { camera, center: pointsCenter(points), distance: pointsDistance(points) };
  }

  function startCamera(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest("[data-room-item]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    cameraPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); beginCameraGesture();
  }

  function moveCamera(event: ReactPointerEvent<HTMLDivElement>) {
    if (!cameraPointersRef.current.has(event.pointerId) || !cameraGestureRef.current) return;
    cameraPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...cameraPointersRef.current.values()]; const center = pointsCenter(points); const gesture = cameraGestureRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    const nextScale = points.length > 1 && gesture.distance > 0 ? Math.min(1.35, Math.max(1, gesture.camera.scale * pointsDistance(points) / gesture.distance)) : gesture.camera.scale;
    const maxX = 16 + rect.width * (nextScale - 1) * 0.28; const maxY = 12 + rect.height * (nextScale - 1) * 0.2;
    setCamera({ scale: nextScale, x: Math.min(maxX, Math.max(-maxX, gesture.camera.x + center.x - gesture.center.x)), y: Math.min(maxY, Math.max(-maxY, gesture.camera.y + center.y - gesture.center.y)) });
  }

  function endCamera(event: ReactPointerEvent<HTMLDivElement>) {
    cameraPointersRef.current.delete(event.pointerId);
    if (cameraPointersRef.current.size) beginCameraGesture(); else cameraGestureRef.current = null;
  }

  const gridCells = selected ? Array.from({ length: ROOM_GRID_SIZE * ROOM_GRID_SIZE }, (_, index) => {
    const row = Math.floor(index / ROOM_GRID_SIZE); const column = index % ROOM_GRID_SIZE;
    const span = ROOM_POSITION_MAX - ROOM_POSITION_MIN;
    const candidate = { ...selected, x: ROOM_POSITION_MIN + span * column / (ROOM_GRID_SIZE - 1), y: ROOM_POSITION_MIN + span * row / (ROOM_GRID_SIZE - 1) };
    return { index, blocked: overlaps(candidate) };
  }) : [];

  return (
    <div className={styles.planner}>
      <section className={`${styles.roomCard} ${isEditing ? styles.editMode : styles.viewMode}`} aria-label="家具を配置する部屋">
        <div className={styles.roomHeading}>
          <div><p className={styles.eyebrow}>MY LITTLE ROOM</p><h2>{isEditing ? "模様替え中" : "わたしの部屋"}</h2></div>
          <div className={styles.headingActions}>
            {isEditing ? <span className={styles.saveState} aria-live="polite"><span className={savingIds.size ? styles.savingDot : styles.savedDot} />{savingIds.size ? "保存中" : "保存済み"}</span> : null}
            <button type="button" className={isEditing ? styles.finishButton : styles.editButton} onClick={toggleEditing}>{isEditing ? "完成を見る" : "模様替え"}</button>
          </div>
        </div>

        <div className={styles.scene} onPointerDown={startCamera} onPointerMove={moveCamera} onPointerUp={endCamera} onPointerCancel={endCamera}>
          <div className={styles.cameraStage} style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})` }}>
            <div className={styles.backWall} aria-hidden="true"><div className={styles.picture}>⌂</div><div className={styles.window}><span /></div><div className={styles.garland}>◆　◆　◆　◆　◆</div></div>
            <div className={styles.leftWall} aria-hidden="true" /><div className={styles.rightWall} aria-hidden="true" /><div className={styles.floor} aria-hidden="true" />
            <div className={styles.floorHit} ref={floorRef}>
              {isEditing && selected ? <div className={styles.gridOverlay} aria-hidden="true">{gridCells.map((cell) => <span key={cell.index} className={cell.blocked ? styles.blockedCell : styles.openCell} />)}</div> : null}
              {placements.map((placement) => {
                const item = itemMap.get(placement.itemId); if (!item?.image) return null;
                const isSelected = selectedId === item.id;
                return (
                  <button type="button" key={item.id} data-room-item className={`${styles.placedItem} ${isEditing ? styles.editableItem : ""} ${isSelected ? styles.selected : ""} ${draggingId === item.id ? styles.dragging : ""} ${invalidId === item.id ? styles.invalid : ""}`} style={placementStyle(placement)} onPointerDown={isEditing ? (event) => startDrag(event, placement) : undefined} onPointerMove={isEditing ? moveDrag : undefined} onPointerUp={isEditing ? endDrag : undefined} onPointerCancel={isEditing ? cancelDrag : undefined} aria-label={isEditing ? `${item.name}を選択して動かす` : item.name} aria-pressed={isEditing ? isSelected : undefined} tabIndex={isEditing ? 0 : -1}>
                    <span className={styles.itemShadow} /><Image src={item.image} alt="" width={128} height={128} draggable={false} />
                  </button>
                );
              })}
              {!isEditing ? <div className={styles.resident} aria-label="部屋の住人"><span /><Image src={residentImage} alt="部屋で過ごすフレンチブルドッグ" width={110} height={94} draggable={false} /></div> : null}
              {placements.length === 0 && isEditing ? <div className={styles.emptyRoom}><span>＋</span>下の一覧から家具を置いてみよう</div> : null}
            </div>
          </div>
          {camera.scale > 1.01 || camera.x !== 0 || camera.y !== 0 ? <button type="button" className={styles.cameraReset} onClick={(event) => { event.stopPropagation(); setCamera({ scale: 1, x: 0, y: 0 }); }}>全体を見る</button> : null}
        </div>

        {isEditing ? <p className={styles.guide} aria-live="polite">{message}</p> : null}
        {isEditing && selected && selectedItem ? (
          <div className={styles.controls} aria-label={`${selectedItem.name}の編集`}>
            <div className={styles.selectedName}><small>選択中</small><strong>{selectedItem.name}</strong></div>
            <div className={styles.controlButtons}>
              <button type="button" onClick={() => updateSelected((entry) => ({ ...entry, rotation: nextRoomRotation(entry.rotation, 1) }))}>↻<small>90°回転</small></button>
              <button type="button" onClick={() => updateSelected((entry) => ({ ...entry, scale: clampRoomScale(entry.scale - 0.1) }))}>−<small>縮小</small></button>
              <button type="button" onClick={() => updateSelected((entry) => ({ ...entry, scale: clampRoomScale(entry.scale + 0.1) }))}>＋<small>拡大</small></button>
              <button type="button" className={styles.placeButton} onClick={() => void commitSelected()}>✓<small>配置</small></button>
              <button type="button" onClick={() => cancelDraft()}>↩<small>キャンセル</small></button>
              <button type="button" className={styles.removeButton} onClick={() => void removeSelected()}>⌂<small>収納</small></button>
            </div>
          </div>
        ) : null}
      </section>

      {isEditing ? (
        <section className={styles.inventory} aria-labelledby="room-inventory-title">
          <div className={styles.inventoryHeading}><div><p className={styles.eyebrow}>MY ITEMS</p><h2 id="room-inventory-title">家具・小物</h2></div><span>{placements.length} / {items.length} 配置中</span></div>
          <div className={styles.filters} aria-label="アイテムの種類">{availableFilters.map((entry) => <button type="button" key={entry.id} className={filter === entry.id ? styles.activeFilter : ""} onClick={() => setFilter(entry.id)}>{entry.label}</button>)}</div>
          {visibleItems.length ? <div className={styles.itemRail}>{visibleItems.map((item) => {
            const isPlaced = placements.some((entry) => entry.itemId === item.id);
            return <button type="button" key={item.id} className={`${styles.inventoryItem} ${isPlaced ? styles.inventoryPlaced : ""}`} onClick={() => placeItem(item)} aria-label={`${item.name}${isPlaced ? "（配置中）" : "を仮置きする"}`}><span className={styles.inventoryArt}>{item.image ? <Image src={item.image} alt="" width={76} height={76} /> : null}<em>{item.rarity}</em>{isPlaced ? <i>配置中</i> : null}</span><span>{item.name}</span></button>;
          })}</div> : <div className={styles.emptyInventory}>この種類のアイテムはまだ持っていません</div>}
        </section>
      ) : null}
    </div>
  );
}
