"use client";

import { useState } from "react";
import { PhotoLightbox } from "./photo-lightbox";

/** 訪問履歴の写真一覧。タップで元の縦横比のまま拡大表示 */
export function VisitPhotoStrip({ photos }: { photos: { id: string; url: string; caption: string | null }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const urls = photos.map((photo) => photo.url);

  return (
    <>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {photos.map((photo, i) => (
          <li key={photo.id} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.caption ?? ""}
              onClick={() => setOpenIndex(i)}
              className="h-24 w-24 cursor-zoom-in rounded-2xl object-cover"
            />
          </li>
        ))}
      </ul>

      {openIndex !== null ? (
        <PhotoLightbox urls={urls} index={openIndex} onIndexChange={setOpenIndex} onClose={() => setOpenIndex(null)} />
      ) : null}
    </>
  );
}
