"use client";

import { DecorationRoom, type DecorationInventoryItem } from "./decoration-room";
import type { TownCatalogItem, TownSnapshot } from "@/lib/town/types";

type TownScreenProps = {
  initialSnapshot: TownSnapshot;
  catalog: TownCatalogItem[];
  initialCoinBalance: number;
  persistenceMode: "supabase" | "local";
  ownedItems: DecorationInventoryItem[];
  totalCollectionCount: number;
};

export function TownScreen(props: TownScreenProps) {
  // The old town snapshot stays in the page contract so this preview can be rolled back
  // without a database migration. Decoration ownership comes from the existing collection.
  void props.initialSnapshot;
  void props.catalog;
  void props.persistenceMode;

  return (
    <DecorationRoom
      items={props.ownedItems}
      totalCollectionCount={props.totalCollectionCount}
      coinBalance={props.initialCoinBalance}
    />
  );
}
