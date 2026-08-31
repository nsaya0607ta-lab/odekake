"use client";

import { memo } from "react";
import {
  TOWN_MATERIAL_KEYS,
  TOWN_MATERIAL_META,
  type TownCatalogItem,
  type TownMaterials,
} from "@/lib/town/types";
import { BuildingArtwork } from "./building-artwork";

type Props = {
  item: TownCatalogItem;
  materials: TownMaterials;
  townLevel: number;
  storedCount: number;
  onSelect: (item: TownCatalogItem) => void;
};

export const BuildingItem = memo(function BuildingItem({
  item,
  materials,
  townLevel,
  storedCount,
  onSelect,
}: Props) {
  const unlocked = townLevel >= item.unlockLevel;
  const canAfford = TOWN_MATERIAL_KEYS.every((key) => materials[key] >= item.cost[key]);
  const canSelect = storedCount > 0 || (unlocked && canAfford);
  const costs = TOWN_MATERIAL_KEYS.filter((key) => item.cost[key] > 0);

  return (
    <article className="w-[184px] shrink-0 rounded-[24px] border border-line bg-card p-3 shadow-[0_8px_20px_rgba(93,80,58,0.08)]">
      <div className="flex h-[96px] items-end justify-center overflow-hidden rounded-[18px] bg-leaf-soft/45">
        <BuildingArtwork itemId={item.id} compact />
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <span>
          <h3 className="text-sm font-black text-ink">{item.name}</h3>
          <p className="text-[10px] font-bold text-ink-faint">
            {item.gridWidth}×{item.gridHeight} ・ EXP +{item.expReward}
          </p>
        </span>
        {storedCount > 0 ? (
          <span className="rounded-full bg-sky-soft px-2 py-0.5 text-[10px] font-black text-[#43718f]">
            収納 {storedCount}
          </span>
        ) : null}
      </div>

      <ul className="mt-2 flex min-h-9 flex-wrap content-start gap-1">
        {costs.map((key) => {
          const enough = materials[key] >= item.cost[key];
          return (
            <li
              key={key}
              className={
                "rounded-full px-2 py-1 text-[10px] font-bold " +
                (enough ? "bg-paper-deep text-ink-soft" : "bg-blossom-soft text-[#a65c68]")
              }
            >
              {TOWN_MATERIAL_META[key].icon} {item.cost[key]}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={!canSelect}
        onClick={() => onSelect(item)}
        className="mt-2 min-h-10 w-full rounded-full bg-leaf px-3 text-xs font-black text-white shadow-sm disabled:bg-line disabled:text-ink-faint"
      >
        {storedCount > 0
          ? "収納から配置"
          : !unlocked
            ? "Lv." + item.unlockLevel + "で解放"
            : canAfford
              ? "建てる"
              : "素材が足りません"}
      </button>
    </article>
  );
});
