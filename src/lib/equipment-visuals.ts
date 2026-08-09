import type { EquipmentMap } from "@/lib/data/equipment";
import { slotOfLevel, type EquipmentSlot } from "@/lib/equipment";

export type DogPose =
  | "stand"
  | "walk"
  | "sit"
  | "sniff"
  | "happy"
  | "shake"
  | "sleep"
  | "wink"
  | "wave"
  | "camera"
  | "bow"
  | "cheer"
  | "smile"
  | "dig"
  | "treat"
  | "roll"
  | "drink"
  | "doze"
  | "yawn"
  | "lieWave";

export type EquipmentLayer = "head-equipment" | "neck-equipment" | "back-equipment" | "body-equipment";

export type EquipmentVisual = {
  level: number;
  name: string;
  src: string;
  slot: Exclude<EquipmentSlot, "title">;
  layer: EquipmentLayer;
};

export const DOG_BASE_POSES: Record<DogPose, string> = {
  stand: "/characters/frenchie-base/stand.webp",
  walk: "/characters/frenchie-base/walk.webp",
  sit: "/characters/frenchie-base/sit.webp",
  sniff: "/characters/frenchie-base/sniff.webp",
  happy: "/characters/frenchie-base/stand-happy.webp",
  shake: "/characters/frenchie-base/shake.webp",
  sleep: "/characters/frenchie-base/sleep.webp",
  wink: "/characters/frenchie-base/wink.webp",
  wave: "/characters/frenchie-base/wave.webp",
  camera: "/characters/frenchie-base/camera.webp",
  bow: "/characters/frenchie-base/bow.webp",
  cheer: "/characters/frenchie-base/cheer.webp",
  smile: "/characters/frenchie-base/smile.webp",
  dig: "/characters/frenchie-base/dig.webp",
  treat: "/characters/frenchie-base/treat.webp",
  roll: "/characters/frenchie-base/roll.webp",
  drink: "/characters/frenchie-base/drink.webp",
  doze: "/characters/frenchie-base/doze.webp",
  yawn: "/characters/frenchie-base/yawn.webp",
  lieWave: "/characters/frenchie-base/lie-wave.webp",
};

export const EQUIPMENT_VISUALS: Readonly<Record<number, EquipmentVisual>> = {
  4: { level: 4, name: "若葉の首輪", src: "/equipment/lv-4-leaf-collar.svg", slot: "collar", layer: "neck-equipment" },
  6: { level: 6, name: "お花のバンダナ", src: "/equipment/lv-6-flower-bandana.svg", slot: "bandana", layer: "neck-equipment" },
  9: { level: 9, name: "おでかけリュック", src: "/equipment/lv-9-daypack.svg", slot: "backpack", layer: "back-equipment" },
  11: { level: 11, name: "夕焼けの首輪", src: "/equipment/lv-11-sunset-collar.svg", slot: "collar", layer: "neck-equipment" },
  15: { level: 15, name: "青空のバンダナ", src: "/equipment/lv-15-sky-bandana.svg", slot: "bandana", layer: "neck-equipment" },
  18: { level: 18, name: "麦わら帽子", src: "/equipment/lv-18-straw-hat.svg", slot: "hat", layer: "head-equipment" },
  21: { level: 21, name: "星空の首輪", src: "/equipment/lv-21-starry-collar.svg", slot: "collar", layer: "neck-equipment" },
  25: { level: 25, name: "探検家リュック", src: "/equipment/lv-25-explorer-pack.svg", slot: "backpack", layer: "back-equipment" },
  27: { level: 27, name: "キャプテン帽", src: "/equipment/lv-27-captain-hat.svg", slot: "hat", layer: "head-equipment" },
  30: { level: 30, name: "旅王のクラウン", src: "/equipment/lv-30-travel-king-crown.svg", slot: "crown", layer: "head-equipment" },
};

export const ACCESSORY_REWARD_LEVELS = [4, 6, 9, 11, 15, 18, 21, 25, 27, 30] as const;

export function getEquipmentVisual(level: number | undefined): EquipmentVisual | null {
  if (level === undefined) return null;
  return EQUIPMENT_VISUALS[level] ?? null;
}

export function equipmentForLevel(level: number | null): EquipmentMap {
  if (level === null) return {};
  const slot = slotOfLevel(level);
  if (!slot || slot === "title") return {};
  return { [slot]: level };
}
