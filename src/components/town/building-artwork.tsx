"use client";

import Image from "next/image";
import { memo } from "react";

const ART: Record<
  string,
  {
    src: string;
    width: number;
    compactWidth: number;
    intrinsicWidth: number;
    intrinsicHeight: number;
  }
> = {
  "town-hall": { src: "/town/town-hall.webp", width: 206, compactWidth: 138, intrinsicWidth: 512, intrinsicHeight: 468 },
  "dog-cafe": { src: "/town/dog-cafe.webp", width: 168, compactWidth: 126, intrinsicWidth: 512, intrinsicHeight: 468 },
  bakery: { src: "/town/bakery.webp", width: 164, compactWidth: 124, intrinsicWidth: 512, intrinsicHeight: 474 },
  "dog-run": { src: "/town/dog-run.webp", width: 202, compactWidth: 142, intrinsicWidth: 576, intrinsicHeight: 384 },
  "hot-spring": { src: "/town/hot-spring.webp", width: 200, compactWidth: 138, intrinsicWidth: 512, intrinsicHeight: 468 },
};

export const BuildingArtwork = memo(function BuildingArtwork({
  itemId,
  compact = false,
  rotation = 0,
}: {
  itemId: string;
  compact?: boolean;
  rotation?: 0 | 90 | 180 | 270;
}) {
  const art = ART[itemId] ?? ART["town-hall"]!;
  const mirrored = rotation === 90 || rotation === 270;

  return (
    <span
      aria-hidden="true"
      className={
        "pointer-events-none relative flex shrink-0 items-end justify-center overflow-visible select-none " +
        (compact ? "h-[94px] w-[154px]" : "h-[176px] w-[224px]")
      }
    >
      <Image
        src={art.src}
        alt=""
        width={art.intrinsicWidth}
        height={art.intrinsicHeight}
        draggable={false}
        unoptimized
        className="block h-auto max-w-none origin-bottom object-contain"
        style={{
          width: compact ? art.compactWidth : art.width,
          transform: mirrored ? "scaleX(-1)" : undefined,
        }}
      />
    </span>
  );
});
