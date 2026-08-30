export type PlaceableBlockId = "grass" | "dirt" | "wood" | "stone" | "flower";
export type BlockId = PlaceableBlockId | "leaves" | "water";

export type BlockGeometryKind = "cube" | "flower" | "water";

export type BlockDefinition = {
  id: BlockId;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  geometry: BlockGeometryKind;
  solid: boolean;
  occludes: boolean;
  breakable: boolean;
  placeable: boolean;
  opacity?: number;
  collectAs?: PlaceableBlockId;
};

/**
 * ブロックの見た目と性質を1か所にまとめる。
 * 将来、訪問スポット報酬や季節ブロックを増やす際は、この定義を追加して
 * ホットバーやユーザー所持素材へIDを渡せる構成にしている。
 */
export const BLOCK_DEFINITIONS: Record<BlockId, BlockDefinition> = {
  grass: {
    id: "grass",
    label: "草ブロック",
    shortLabel: "草",
    icon: "🌿",
    color: "#91c77b",
    geometry: "cube",
    solid: true,
    occludes: true,
    breakable: true,
    placeable: true,
    collectAs: "grass",
  },
  dirt: {
    id: "dirt",
    label: "土ブロック",
    shortLabel: "土",
    icon: "🟫",
    color: "#c99467",
    geometry: "cube",
    solid: true,
    occludes: true,
    breakable: true,
    placeable: true,
    collectAs: "dirt",
  },
  wood: {
    id: "wood",
    label: "木ブロック",
    shortLabel: "木",
    icon: "🪵",
    color: "#b77b4c",
    geometry: "cube",
    solid: true,
    occludes: true,
    breakable: true,
    placeable: true,
    collectAs: "wood",
  },
  stone: {
    id: "stone",
    label: "石ブロック",
    shortLabel: "石",
    icon: "🪨",
    color: "#a7aaa7",
    geometry: "cube",
    solid: true,
    occludes: true,
    breakable: true,
    placeable: true,
    collectAs: "stone",
  },
  flower: {
    id: "flower",
    label: "花ブロック",
    shortLabel: "花",
    icon: "🌸",
    color: "#f0a5bc",
    geometry: "flower",
    solid: false,
    occludes: false,
    breakable: true,
    placeable: true,
    collectAs: "flower",
  },
  leaves: {
    id: "leaves",
    label: "やわらかい葉",
    shortLabel: "葉",
    icon: "🍃",
    color: "#78b98a",
    geometry: "cube",
    solid: true,
    occludes: true,
    breakable: true,
    placeable: false,
    collectAs: "wood",
  },
  water: {
    id: "water",
    label: "水",
    shortLabel: "水",
    icon: "💧",
    color: "#79c9e5",
    geometry: "water",
    solid: false,
    occludes: false,
    breakable: false,
    placeable: false,
    opacity: 0.72,
  },
};

export const HOTBAR_BLOCK_IDS: readonly PlaceableBlockId[] = ["grass", "dirt", "wood", "stone", "flower"];

export const INITIAL_BLOCK_INVENTORY: Record<PlaceableBlockId, number> = {
  grass: 8,
  dirt: 12,
  wood: 8,
  stone: 10,
  flower: 5,
};

export const BLOCK_GARDEN_WORLD = {
  size: 22,
  min: -11,
  max: 10,
  minY: 0,
  maxY: 12,
  reach: 6,
} as const;
