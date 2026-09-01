import type {
  TownCatalogItem,
  TownPlacedItem,
  TownPlacementCandidate,
} from "./types";

export const TOWN_GRID_SIZE = 14;
export const TOWN_TILE_WIDTH = 68;
export const TOWN_TILE_HEIGHT = 34;
export const TOWN_WORLD_WIDTH = 1000;
export const TOWN_WORLD_HEIGHT = 560;
export const TOWN_ORIGIN_X = 500;
export const TOWN_ORIGIN_Y = 38;

export type TownArea = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const TOWN_AREAS: readonly TownArea[] = [
  { id: "core", x: 2, y: 2, width: 10, height: 10 },
  { id: "north", x: 2, y: 0, width: 10, height: 2 },
  { id: "east", x: 12, y: 2, width: 2, height: 10 },
  { id: "south", x: 2, y: 12, width: 10, height: 2 },
  { id: "west", x: 0, y: 2, width: 2, height: 10 },
] as const;

export type Point = { x: number; y: number };

export function projectTownPoint(gridX: number, gridY: number): Point {
  return {
    x: TOWN_ORIGIN_X + (gridX - gridY) * (TOWN_TILE_WIDTH / 2),
    y: TOWN_ORIGIN_Y + (gridX + gridY) * (TOWN_TILE_HEIGHT / 2),
  };
}

export function townFootprint(
  item: Pick<TownCatalogItem, "gridWidth" | "gridHeight">,
  rotation: number,
): { width: number; height: number } {
  return Math.abs(rotation % 180) === 90
    ? { width: item.gridHeight, height: item.gridWidth }
    : { width: item.gridWidth, height: item.gridHeight };
}

export function placementAnchor(
  placement: Pick<TownPlacedItem, "gridX" | "gridY" | "rotation">,
  item: TownCatalogItem,
): Point {
  const footprint = townFootprint(item, placement.rotation);
  return projectTownPoint(
    placement.gridX + footprint.width / 2,
    placement.gridY + footprint.height / 2,
  );
}

export function placementPolygon(
  placement: Pick<TownPlacedItem, "gridX" | "gridY" | "rotation">,
  item: TownCatalogItem,
): string {
  const { width, height } = townFootprint(item, placement.rotation);
  const points = [
    projectTownPoint(placement.gridX, placement.gridY),
    projectTownPoint(placement.gridX + width, placement.gridY),
    projectTownPoint(placement.gridX + width, placement.gridY + height),
    projectTownPoint(placement.gridX, placement.gridY + height),
  ];
  return "polygon(" + points.map((point) => point.x + "px " + point.y + "px").join(",") + ")";
}

export function areaPolygon(area: TownArea): string {
  const points = [
    projectTownPoint(area.x, area.y),
    projectTownPoint(area.x + area.width, area.y),
    projectTownPoint(area.x + area.width, area.y + area.height),
    projectTownPoint(area.x, area.y + area.height),
  ];
  return "polygon(" + points.map((point) => point.x + "px " + point.y + "px").join(",") + ")";
}

function isCellUnlocked(unlockedAreas: readonly string[], x: number, y: number): boolean {
  return TOWN_AREAS.some(
    (area) =>
      unlockedAreas.includes(area.id) &&
      x >= area.x &&
      x < area.x + area.width &&
      y >= area.y &&
      y < area.y + area.height,
  );
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function canPlaceTownItem({
  candidate,
  catalog,
  placedItems,
  unlockedAreas,
}: {
  candidate: TownPlacementCandidate;
  catalog: readonly TownCatalogItem[];
  placedItems: readonly TownPlacedItem[];
  unlockedAreas: readonly string[];
}): boolean {
  const item = catalog.find((entry) => entry.id === candidate.itemId);
  if (!item) return false;

  const footprint = townFootprint(item, candidate.rotation);
  const boundaryPadding =
    item.category === "building" || item.category === "facility" ? 1 : 0;
  if (
    candidate.gridX - boundaryPadding < 0 ||
    candidate.gridY - boundaryPadding < 0 ||
    candidate.gridX + footprint.width + boundaryPadding > TOWN_GRID_SIZE ||
    candidate.gridY + footprint.height + boundaryPadding > TOWN_GRID_SIZE
  ) {
    return false;
  }

  for (
    let x = candidate.gridX - boundaryPadding;
    x < candidate.gridX + footprint.width + boundaryPadding;
    x += 1
  ) {
    for (
      let y = candidate.gridY - boundaryPadding;
      y < candidate.gridY + footprint.height + boundaryPadding;
      y += 1
    ) {
      if (!isCellUnlocked(unlockedAreas, x, y)) return false;
    }
  }

  return !placedItems.some((placed) => {
    if (!placed.isPlaced || placed.instanceId === candidate.instanceId) return false;
    const placedItem = catalog.find((entry) => entry.id === placed.itemId);
    if (!placedItem) return false;
    const placedFootprint = townFootprint(placedItem, placed.rotation);
    const structureSpacing =
      (item.category === "building" || item.category === "facility") &&
      (placedItem.category === "building" || placedItem.category === "facility")
        ? 1
        : 0;
    return overlaps(
      {
        x: candidate.gridX - structureSpacing,
        y: candidate.gridY - structureSpacing,
        width: footprint.width + structureSpacing * 2,
        height: footprint.height + structureSpacing * 2,
      },
      {
        x: placed.gridX,
        y: placed.gridY,
        width: placedFootprint.width,
        height: placedFootprint.height,
      },
    );
  });
}

export function findFirstTownPlacement({
  item,
  catalog,
  placedItems,
  unlockedAreas,
}: {
  item: TownCatalogItem;
  catalog: readonly TownCatalogItem[];
  placedItems: readonly TownPlacedItem[];
  unlockedAreas: readonly string[];
}): Pick<TownPlacementCandidate, "gridX" | "gridY" | "rotation"> | null {
  for (let diagonal = 0; diagonal < TOWN_GRID_SIZE * 2; diagonal += 1) {
    for (let y = 0; y < TOWN_GRID_SIZE; y += 1) {
      const x = diagonal - y;
      if (x < 0 || x >= TOWN_GRID_SIZE) continue;
      const candidate: TownPlacementCandidate = {
        source: "new",
        itemId: item.id,
        gridX: x,
        gridY: y,
        rotation: 0,
      };
      if (canPlaceTownItem({ candidate, catalog, placedItems, unlockedAreas })) {
        return { gridX: x, gridY: y, rotation: 0 };
      }
    }
  }
  return null;
}

export function screenPointToGrid({
  worldX,
  worldY,
  item,
  rotation,
}: {
  worldX: number;
  worldY: number;
  item: TownCatalogItem;
  rotation: number;
}): { gridX: number; gridY: number } {
  const isoX = (worldX - TOWN_ORIGIN_X) / (TOWN_TILE_WIDTH / 2);
  const isoY = (worldY - TOWN_ORIGIN_Y) / (TOWN_TILE_HEIGHT / 2);
  const centerX = (isoX + isoY) / 2;
  const centerY = (isoY - isoX) / 2;
  const footprint = townFootprint(item, rotation);

  return {
    gridX: Math.max(0, Math.min(TOWN_GRID_SIZE - footprint.width, Math.round(centerX - footprint.width / 2))),
    gridY: Math.max(0, Math.min(TOWN_GRID_SIZE - footprint.height, Math.round(centerY - footprint.height / 2))),
  };
}
