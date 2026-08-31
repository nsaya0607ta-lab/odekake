"use client";

import Image from "next/image";
import { memo } from "react";

export type TownSceneryKind = "tree" | "shrub" | "flowers";

const SCENERY: Record<
  TownSceneryKind,
  {
    src: string;
    width: number;
    height: number;
    displayWidth: number;
  }
> = {
  tree: {
    src: "/town/scenery-tree.webp",
    width: 337,
    height: 360,
    displayWidth: 104,
  },
  shrub: {
    src: "/town/scenery-shrub.webp",
    width: 320,
    height: 213,
    displayWidth: 88,
  },
  flowers: {
    src: "/town/scenery-flowers.webp",
    width: 320,
    height: 213,
    displayWidth: 82,
  },
};

export const TownScenery = memo(function TownScenery({
  kind,
}: {
  kind: TownSceneryKind;
}) {
  const art = SCENERY[kind];

  return (
    <Image
      src={art.src}
      alt=""
      width={art.width}
      height={art.height}
      draggable={false}
      unoptimized
      className="pointer-events-none block h-auto max-w-none select-none"
      style={{ width: art.displayWidth }}
    />
  );
});
