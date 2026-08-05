"use client";

import { useRef, useState } from "react";
import { IconCamera } from "./icons";

/** 横スワイプで見る写真一覧。枚数と現在位置を表示する */
export function PhotoGallery({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (urls.length === 0) {
    return (
      <div className="rough-card flex aspect-[4/3] flex-col items-center justify-center gap-2 text-ink-faint">
        <IconCamera size={30} />
        <p className="text-sm">写真はまだありません</p>
      </div>
    );
  }

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== index) setIndex(next);
  };

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl"
        style={{ scrollbarWidth: "none" }}
      >
        {urls.map((url, i) => (
          <div key={`${url}-${i}`} className="w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`写真 ${i + 1}枚目`} className="aspect-[4/3] w-full object-cover" />
          </div>
        ))}
      </div>

      <p className="absolute right-3 bottom-3 rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
        {index + 1}/{urls.length}
      </p>
    </div>
  );
}
