import type { Json } from "@/lib/supabase/types";
import type { DB } from "@/lib/data/client";
import {
  EMPTY_TOWN_MATERIALS,
  TOWN_MATERIAL_KEYS,
  type TownCatalogItem,
  type TownCategory,
  type TownMaterials,
  type TownPlacedItem,
  type TownSnapshot,
} from "./types";

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function integerOf(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

export function normalizeTownMaterials(value: unknown): TownMaterials {
  const record = recordOf(value);
  return TOWN_MATERIAL_KEYS.reduce<TownMaterials>(
    (materials, key) => {
      materials[key] = Math.max(0, integerOf(record[key]));
      return materials;
    },
    { ...EMPTY_TOWN_MATERIALS },
  );
}

function normalizeRotation(value: unknown): 0 | 90 | 180 | 270 {
  const normalized = ((integerOf(value) % 360) + 360) % 360;
  return normalized === 90 || normalized === 180 || normalized === 270 ? normalized : 0;
}

export function parseTownSnapshot(value: Json | null): TownSnapshot {
  const root = recordOf(value);
  const town = recordOf(root.town);
  const rawItems = Array.isArray(root.items) ? root.items : [];

  const items = rawItems.flatMap<TownPlacedItem>((raw) => {
    const item = recordOf(raw);
    if (typeof item.instanceId !== "string" || typeof item.itemId !== "string") return [];
    return [{
      instanceId: item.instanceId,
      itemId: item.itemId,
      gridX: integerOf(item.gridX),
      gridY: integerOf(item.gridY),
      rotation: normalizeRotation(item.rotation),
      isPlaced: item.isPlaced !== false,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
    }];
  });

  return {
    town: {
      townName: typeof town.townName === "string" && town.townName.trim() ? town.townName : "わんこタウン",
      townLevel: Math.max(1, integerOf(town.townLevel, 1)),
      townExp: Math.max(0, integerOf(town.townExp)),
      unlockedAreas: Array.isArray(town.unlockedAreas)
        ? town.unlockedAreas.filter((area): area is string => typeof area === "string")
        : ["core"],
      materials: normalizeTownMaterials(town.materials),
      updatedAt: typeof town.updatedAt === "string" ? town.updatedAt : "",
    },
    items,
  };
}

export async function getTownSnapshot(supabase: DB): Promise<TownSnapshot> {
  const { data, error } = await supabase.rpc("get_or_create_town");
  if (error) {
    console.error("Failed to load town", { code: error.code, message: error.message });
    throw new Error("タウン情報を読み込めませんでした。");
  }
  return parseTownSnapshot(data);
}

export async function getTownCatalog(supabase: DB): Promise<TownCatalogItem[]> {
  const { data, error } = await supabase
    .from("town_catalog_items")
    .select("id,name,category,grid_width,grid_height,unlock_level,cost,exp_reward,sort_order")
    .eq("active", true)
    .order("sort_order");

  if (error) {
    console.error("Failed to load town catalog", { code: error.code, message: error.message });
    throw new Error("建物一覧を読み込めませんでした。");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category as TownCategory,
    gridWidth: row.grid_width,
    gridHeight: row.grid_height,
    unlockLevel: row.unlock_level,
    cost: normalizeTownMaterials(row.cost),
    expReward: row.exp_reward,
    sortOrder: row.sort_order,
  }));
}


export const FALLBACK_TOWN_CATALOG: TownCatalogItem[] = [
  { id: "town-hall", name: "タウンホール", category: "building", gridWidth: 3, gridHeight: 3, unlockLevel: 1, cost: { wood: 80, stone: 60, flower: 0, shell: 0, iron: 20 }, expReward: 80, sortOrder: 10 },
  { id: "dog-cafe", name: "ドッグカフェ", category: "building", gridWidth: 2, gridHeight: 2, unlockLevel: 1, cost: { wood: 120, stone: 80, flower: 40, shell: 0, iron: 0 }, expReward: 65, sortOrder: 20 },
  { id: "bakery", name: "ベーカリー", category: "building", gridWidth: 2, gridHeight: 2, unlockLevel: 1, cost: { wood: 100, stone: 60, flower: 50, shell: 0, iron: 0 }, expReward: 60, sortOrder: 30 },
  { id: "dog-run", name: "ドッグラン", category: "facility", gridWidth: 3, gridHeight: 2, unlockLevel: 2, cost: { wood: 90, stone: 0, flower: 30, shell: 0, iron: 10 }, expReward: 75, sortOrder: 40 },
  { id: "hot-spring", name: "温泉", category: "facility", gridWidth: 3, gridHeight: 3, unlockLevel: 3, cost: { wood: 150, stone: 100, flower: 0, shell: 30, iron: 20 }, expReward: 110, sortOrder: 50 },
];

export const FALLBACK_TOWN_SNAPSHOT: TownSnapshot = {
  town: {
    townName: "わんこタウン",
    townLevel: 1,
    townExp: 0,
    unlockedAreas: ["core"],
    materials: { wood: 700, stone: 360, flower: 180, shell: 120, iron: 80 },
    updatedAt: "",
  },
  items: [],
};
