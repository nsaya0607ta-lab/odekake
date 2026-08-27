import type { CollectionCategory, CollectionItem } from "@/lib/collection/items";
import type { RoomPlacement, RoomRotation } from "@/lib/data/room";

export const ROOM_SCALE_MIN = 0.7;
export const ROOM_SCALE_MAX = 1.35;
export const ROOM_POSITION_MIN = 0.06;
export const ROOM_POSITION_MAX = 0.94;

type Footprint = { width: number; depth: number };

const CATEGORY_FOOTPRINTS: Record<CollectionCategory, Footprint> = {
  toy: { width: 0.13, depth: 0.1 },
  food: { width: 0.11, depth: 0.09 },
  interior: { width: 0.18, depth: 0.14 },
  accessory: { width: 0.1, depth: 0.08 },
  other: { width: 0.14, depth: 0.11 },
};

const LARGE_ITEM_HINTS = ["kotatsu", "hammock", "parasol", "fireplace", "kamakura", "shooting_gallery"];
const TALL_ITEM_HINTS = ["telescope", "stove", "lantern", "sudare", "skis", "poles"];

export function getRoomFootprint(item: CollectionItem, placement: Pick<RoomPlacement, "rotation" | "scale">): Footprint {
  const base = CATEGORY_FOOTPRINTS[item.category];
  const large = LARGE_ITEM_HINTS.some((hint) => item.id.includes(hint));
  const tall = TALL_ITEM_HINTS.some((hint) => item.id.includes(hint));
  const width = base.width * (large ? 1.45 : tall ? 1.15 : 1) * placement.scale;
  const depth = base.depth * (large ? 1.35 : tall ? 1.2 : 1) * placement.scale;
  return placement.rotation === 90 || placement.rotation === 270
    ? { width: depth, depth: width }
    : { width, depth };
}

export function placementsOverlap(
  first: RoomPlacement,
  firstItem: CollectionItem,
  second: RoomPlacement,
  secondItem: CollectionItem,
): boolean {
  const a = getRoomFootprint(firstItem, first);
  const b = getRoomFootprint(secondItem, second);
  return (
    Math.abs(first.x - second.x) < (a.width + b.width) * 0.42 &&
    Math.abs(first.y - second.y) < (a.depth + b.depth) * 0.42
  );
}

export function clampRoomPosition(value: number): number {
  return Math.min(ROOM_POSITION_MAX, Math.max(ROOM_POSITION_MIN, value));
}

export function clampRoomScale(value: number): number {
  return Math.min(ROOM_SCALE_MAX, Math.max(ROOM_SCALE_MIN, Math.round(value * 20) / 20));
}

export function nextRoomRotation(rotation: RoomRotation, direction: 1 | -1): RoomRotation {
  return ((rotation + direction * 90 + 360) % 360) as RoomRotation;
}
