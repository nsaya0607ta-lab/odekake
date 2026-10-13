import type { Tile } from "./town-builder";

export type LeveledBuilding = "house" | "shop" | "factory";
export type BuildingVolume = { u: number; v: number; w: number; d: number; height: number; z: number };
export const BUILDING_STAGES: Record<LeveledBuilding, readonly string[]> = {
  house: ["一戸建て", "集合住宅", "高層レジデンス"],
  shop: ["小さな商店", "商業ビル", "大型商業施設"],
  factory: ["小さな工場", "生産工場", "大型プラント"],
};
export const buildingLevel = (level: number) => Math.max(1, Math.min(3, Math.floor(level || 1)));
export function buildingStage(kind: Tile | undefined, level: number): string | undefined {
  return kind && kind in BUILDING_STAGES ? BUILDING_STAGES[kind as LeveledBuilding][buildingLevel(level) - 1] : undefined;
}
const volume = (u: number, v: number, w: number, d: number, height: number, z = 0): BuildingVolume => ({ u, v, w, d, height, z });

/** Shared geometry keeps the artwork, touch picking and cached bounds together. */
export function buildingVolumes(kind: LeveledBuilding, level: number): BuildingVolume[] {
  const l = buildingLevel(level);
  if (kind === "house") return l === 1 ? [volume(.16, .15, .67, .65, 17)] : l === 2 ? [volume(.14, .13, .72, .70, 53)] : [volume(.14, .13, .72, .70, 17), volume(.24, .20, .54, .52, 60, 17)];
  if (kind === "shop") return l === 1 ? [volume(.16, .15, .67, .65, 29)] : l === 2 ? [volume(.13, .12, .74, .71, 41)] : [volume(.10, .12, .80, .72, 17), volume(.16, .16, .68, .62, 26, 17), volume(.22, .21, .56, .48, 29, 43)];
  return l === 1 ? [volume(.16, .15, .72, .64, 26)] : l === 2 ? [volume(.16, .15, .72, .44, 38), volume(.16, .59, .72, .24, 17)] : [volume(.12, .14, .76, .42, 50), volume(.12, .56, .76, .28, 25)];
}
export function factoryLayout(level: number) {
  const l = buildingLevel(level), volumes = buildingVolumes("factory", l), main = volumes[0]!;
  return {
    volumes,
    main,
    vent: { u: l === 3 ? .15 : .16, v: .23, w: .22, d: l === 1 ? .48 : l === 2 ? .30 : .26 },
    solar: { u: .20, v: l === 1 ? .28 : .25, w: .58, d: l === 1 ? .36 : .24, z: main.height + 5 },
    stacks: l === 3 ? [volume(.78, .15, .10, .06, 32, 50), volume(.64, .15, .075, .06, 24, 50)] : [volume(.77, .16, .10, .06, (l === 1 ? 47 : 63) - main.height, main.height)],
  };
}
export function roofFeatures(kind: "house" | "shop", level: number): BuildingVolume[] {
  const l = buildingLevel(level);
  if (l < 2) return [];
  if (kind === "house") return l === 2 ? [volume(.24, .26, .16, .12, 5, 55)] : [volume(.30, .27, .16, .16, 6, 79), volume(.54, .35, .18, .17, 7, 79)];
  return l === 2 ? [volume(.22, .26, .20, .18, 5, 43)] : [volume(.32, .31, .22, .22, 7, 74)];
}
export function buildingHeight(kind: LeveledBuilding, level: number) {
  const l = buildingLevel(level);
  if (kind === "factory") return Math.max(...factoryLayout(l).stacks.map(s => s.z + s.height));
  if (kind === "house" && l === 1) return 32;
  if (kind === "shop" && l === 1) return 37;
  const volumes = [...buildingVolumes(kind, l), ...roofFeatures(kind, l)];
  return Math.max(...volumes.map(v => v.z + v.height));
}
