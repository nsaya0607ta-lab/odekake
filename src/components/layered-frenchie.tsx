"use client";

import Image from "next/image";
import { memo } from "react";
import type { CSSProperties } from "react";
import type { EquipmentMap } from "@/lib/data/equipment";
import {
  DOG_BASE_POSES,
  getEquipmentVisual,
  type DogPose,
  type EquipmentLayer,
  type EquipmentVisual,
} from "@/lib/equipment-visuals";

type LayeredFrenchieProps = {
  pose?: DogPose;
  equipment?: EquipmentMap;
  className?: string;
  priority?: boolean;
  alt?: string;
};

type PoseShift = { x?: number; y?: number; scale?: number; rotate?: number };

const POSE_SHIFTS: Partial<Record<DogPose, Partial<Record<EquipmentLayer, PoseShift>>>> = {
  walk: { "head-equipment": { x: 10 }, "neck-equipment": { x: 10 }, "back-equipment": { x: 8 } },
  happy: { "head-equipment": { x: 10 }, "neck-equipment": { x: 10 }, "back-equipment": { x: 8 } },
  sit: { "neck-equipment": { y: 5 }, "back-equipment": { x: -8, y: 18, scale: 0.82, rotate: 8 } },
  sniff: {
    "head-equipment": { x: -38, y: 62, scale: 0.88, rotate: -9 },
    "neck-equipment": { x: -34, y: 54, scale: 0.9, rotate: -8 },
    "back-equipment": { x: 2, y: 16, rotate: 4 },
  },
  shake: { "head-equipment": { x: -28, y: 9 }, "neck-equipment": { x: -24, y: 10 }, "back-equipment": { x: -12, y: 9 } },
  sleep: {
    "head-equipment": { x: -42, y: 52, scale: 0.82, rotate: -8 },
    "neck-equipment": { x: -38, y: 50, scale: 0.84, rotate: -7 },
    "back-equipment": { x: 0, y: 18, scale: 0.92 },
  },
  wave: { "head-equipment": { x: 6, y: 4, scale: 0.94 }, "neck-equipment": { x: 6, y: 7 }, "back-equipment": { x: 2, y: 7 } },
  camera: { "head-equipment": { x: -8, y: 5 }, "neck-equipment": { x: -8, y: 8 }, "back-equipment": { x: -4, y: 8 } },
  bow: {
    "head-equipment": { x: -46, y: 62, scale: 0.82, rotate: -10 },
    "neck-equipment": { x: -40, y: 58, scale: 0.86, rotate: -9 },
    "back-equipment": { x: 5, y: 18, rotate: 4 },
  },
  cheer: { "head-equipment": { x: -10, y: -2, scale: 0.94 }, "neck-equipment": { x: -8, y: 3 }, "back-equipment": { x: -4, y: 8 } },
  smile: { "head-equipment": { x: 10 }, "neck-equipment": { x: 10 }, "back-equipment": { x: 8 } },
  dig: {
    "head-equipment": { x: -38, y: 52, scale: 0.86, rotate: -8 },
    "neck-equipment": { x: -35, y: 48, scale: 0.88, rotate: -7 },
    "back-equipment": { x: 0, y: 16, rotate: 3 },
  },
  treat: { "head-equipment": { x: 4, y: 7, scale: 0.92 }, "neck-equipment": { x: 4, y: 10 }, "back-equipment": { x: -12, y: 20, scale: 0.8, rotate: 12 } },
  roll: {
    "head-equipment": { x: -18, y: 69, scale: 0.78, rotate: -105 },
    "neck-equipment": { x: -15, y: 60, scale: 0.82, rotate: -90 },
    "back-equipment": { x: 4, y: 34, scale: 0.82, rotate: 85 },
  },
  drink: { "head-equipment": { x: -18, y: 25, scale: 0.9, rotate: -8 }, "neck-equipment": { x: -16, y: 26, scale: 0.92 }, "back-equipment": { x: -2, y: 11 } },
  doze: {
    "head-equipment": { x: 4, y: 26, scale: 0.9, rotate: 6 },
    "neck-equipment": { x: 2, y: 28, scale: 0.92 },
    "back-equipment": { x: -10, y: 24, scale: 0.76, rotate: 15 },
  },
  yawn: { "head-equipment": { x: -12, y: 4, scale: 0.92 }, "neck-equipment": { x: -10, y: 8 }, "back-equipment": { x: -12, y: 19, scale: 0.8 } },
  lieWave: { "head-equipment": { x: 4, y: 25, scale: 0.9, rotate: 5 }, "neck-equipment": { x: 4, y: 27, scale: 0.92 }, "back-equipment": { x: -12, y: 24, scale: 0.76, rotate: 14 } },
};

const SLOT_LAYOUT: Record<EquipmentVisual["slot"], CSSProperties> = {
  collar: { left: "36%", top: "53%", width: "30%", height: "30%" },
  bandana: { left: "35%", top: "50%", width: "34%", height: "38%" },
  backpack: { left: "47%", top: "36%", width: "32%", height: "44%" },
  hat: { left: "18%", top: "2%", width: "54%", height: "40%" },
  crown: { left: "27%", top: "2%", width: "36%", height: "31%" },
};

const LAYERS: readonly EquipmentLayer[] = ["back-equipment", "neck-equipment", "body-equipment", "head-equipment"];

function EquipmentAsset({ visual, pose, priority }: { visual: EquipmentVisual; pose: DogPose; priority: boolean }) {
  const shift = POSE_SHIFTS[pose]?.[visual.layer];
  const transform = `translate3d(${shift?.x ?? 0}%, ${shift?.y ?? 0}%, 0) scale(${shift?.scale ?? 1}) rotate(${shift?.rotate ?? 0}deg)`;

  return (
    <span className="absolute origin-center will-change-transform" style={{ ...SLOT_LAYOUT[visual.slot], transform }}>
      <Image
        src={visual.src}
        alt=""
        fill
        priority={priority}
        sizes="160px"
        className="pointer-events-none select-none object-contain"
        draggable={false}
      />
    </span>
  );
}

export const DogEquipmentLayers = memo(function DogEquipmentLayers({
  pose,
  equipment,
  priority = false,
}: {
  pose: DogPose;
  equipment: EquipmentMap;
  priority?: boolean;
}) {
  const visuals = [
    getEquipmentVisual(equipment.collar),
    getEquipmentVisual(equipment.bandana),
    getEquipmentVisual(equipment.backpack),
    getEquipmentVisual(equipment.hat),
    getEquipmentVisual(equipment.crown),
  ].filter((visual): visual is EquipmentVisual => visual !== null);

  return LAYERS.map((layer) => (
    <span key={layer} data-layer={layer} className="pointer-events-none absolute inset-0">
      {visuals
        .filter((visual) => visual.layer === layer)
        .map((visual) => <EquipmentAsset key={visual.level} visual={visual} pose={pose} priority={priority} />)}
    </span>
  ));
});

const EMPTY_EQUIPMENT: EquipmentMap = {};

const DogBase = memo(function DogBase({
  pose,
  priority,
  alt,
}: {
  pose: DogPose;
  priority: boolean;
  alt: string;
}) {
  return (
    <span data-layer="dog-base" className="absolute inset-0">
      <Image
        src={DOG_BASE_POSES[pose]}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 640px) 160px, 190px"
        className="select-none object-contain"
        draggable={false}
      />
    </span>
  );
});

export const LayeredFrenchie = memo(function LayeredFrenchie({
  pose = "happy",
  equipment = EMPTY_EQUIPMENT,
  className = "",
  priority = false,
  alt = "フレンチブルドッグ",
}: LayeredFrenchieProps) {
  return (
    <span className={`relative block aspect-[300/254] ${className}`}>
      <DogBase pose={pose} priority={priority} alt={alt} />
      <DogEquipmentLayers pose={pose} equipment={equipment} priority={priority} />
    </span>
  );
});

export function EquipmentItemImage({ level, priority = false }: { level: number; priority?: boolean }) {
  const visual = getEquipmentVisual(level);
  if (!visual) return null;

  return (
    <span className="relative block aspect-square h-full w-full">
      <Image
        src={visual.src}
        alt={visual.name}
        fill
        priority={priority}
        sizes="96px"
        className="object-contain"
      />
    </span>
  );
}
