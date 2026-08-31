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
  "town-hall": { src: "/town/town-hall.webp", width: 224, compactWidth: 138, intrinsicWidth: 640, intrinsicHeight: 585 },
  "dog-cafe": { src: "/town/dog-cafe.webp", width: 184, compactWidth: 126, intrinsicWidth: 640, intrinsicHeight: 585 },
  bakery: { src: "/town/bakery.webp", width: 180, compactWidth: 124, intrinsicWidth: 640, intrinsicHeight: 592 },
  "dog-run": { src: "/town/dog-run.webp", width: 218, compactWidth: 142, intrinsicWidth: 720, intrinsicHeight: 480 },
  "hot-spring": { src: "/town/hot-spring.webp", width: 216, compactWidth: 138, intrinsicWidth: 640, intrinsicHeight: 585 },
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
        className="block h-auto max-w-none origin-bottom object-contain drop-shadow-[0_7px_5px_rgba(55,51,43,0.22)]"
        style={{
          width: compact ? art.compactWidth : art.width,
          transform: mirrored ? "scaleX(-1)" : undefined,
        }}
      />
    </span>
  );
});
