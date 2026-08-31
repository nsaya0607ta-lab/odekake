"use client";

import { useRef, useState } from "react";
import { IconCamera } from "./icons";
import { PhotoLightbox } from "./photo-lightbox";

/** 横スワイプで見る写真一覧。枚数と現在位置を表示する。タップで元の縦横比のまま拡大表示 */
export function PhotoGallery({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
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
            <img
              src={url}
              alt={`写真 ${i + 1}枚目`}
              onClick={() => setOpenIndex(i)}
              className="aspect-[4/3] w-full cursor-zoom-in object-cover"
            />
          </div>
        ))}
      </div>

      <p className="absolute right-3 bottom-3 rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
        {index + 1}/{urls.length}
      </p>

      {openIndex !== null ? (
        <PhotoLightbox urls={urls} index={openIndex} onIndexChange={setOpenIndex} onClose={() => setOpenIndex(null)} />
      ) : null}
    </div>
  );
}
