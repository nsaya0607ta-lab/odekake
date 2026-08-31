export const TOWN_MATERIAL_KEYS = ["wood", "stone", "flower", "shell", "iron"] as const;

export type TownMaterialKey = (typeof TOWN_MATERIAL_KEYS)[number];
export type TownMaterials = Record<TownMaterialKey, number>;
export type TownCategory = "building" | "facility" | "decor" | "road" | "nature";

export const TOWN_MATERIAL_META: Record<
  TownMaterialKey,
  { label: string; icon: string; shortLabel: string }
> = {
  wood: { label: "木材", shortLabel: "木", icon: "🪵" },
  stone: { label: "石材", shortLabel: "石", icon: "🪨" },
  flower: { label: "花", shortLabel: "花", icon: "🌼" },
  shell: { label: "貝がら", shortLabel: "貝", icon: "🐚" },
  iron: { label: "鉄材", shortLabel: "鉄", icon: "🔩" },
};

export type TownCatalogItem = {
  id: string;
  name: string;
  category: TownCategory;
  gridWidth: number;
  gridHeight: number;
  unlockLevel: number;
  cost: TownMaterials;
  expReward: number;
  sortOrder: number;
};

export type TownPlacedItem = {
  instanceId: string;
  itemId: string;
  gridX: number;
  gridY: number;
  rotation: 0 | 90 | 180 | 270;
  isPlaced: boolean;
  createdAt: string;
};

export type TownState = {
  townName: string;
  townLevel: number;
  townExp: number;
  unlockedAreas: string[];
  materials: TownMaterials;
  updatedAt: string;
};

export type TownSnapshot = {
  town: TownState;
  items: TownPlacedItem[];
};

export type TownPlacementCandidate = {
  source: "new" | "stored" | "move";
  itemId: string;
  instanceId?: string;
  gridX: number;
  gridY: number;
  rotation: 0 | 90 | 180 | 270;
};

export const EMPTY_TOWN_MATERIALS: TownMaterials = {
  wood: 0,
  stone: 0,
  flower: 0,
  shell: 0,
  iron: 0,
};
