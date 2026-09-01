"use client";

import { BlockGardenLoader } from "@/components/block-garden/block-garden-loader";
import type { TownCatalogItem, TownSnapshot } from "@/lib/town/types";

type TownScreenProps = {
  initialSnapshot: TownSnapshot;
  catalog: TownCatalogItem[];
  initialCoinBalance: number;
  persistenceMode: "supabase" | "local";
};

export function TownScreen(props: TownScreenProps) {
  // The server still prepares and authorizes the existing town snapshot.
  // Keeping the same prop contract lets us return to the placement town without a DB migration.
  void props;

  return (
    <BlockGardenLoader
      returnHref="/home"
      title="わんこタウン"
      eyebrow="ブロックタウン"
    />
  );
}
