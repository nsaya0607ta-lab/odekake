"use client";

import { useState } from "react";
import { IconClose } from "@/components/icons";

/**
 * つぶやきに添付された写真（最大4枚）をTwitterのようなグリッドで並べる。
 * 転送量を抑えるため、グリッドに出す画像は常にサムネイル（-thumb）。
 * タップすると原寸（アップロード時に圧縮済みの本画像）を初めて読み込み、
 * 全画面で拡大表示する — 原寸は開いたときだけ読み込まれる
 */
export function SnsPostPhotoGrid({ photoUrls, fullUrls }: { photoUrls: string[]; fullUrls: string[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (photoUrls.length === 0) return null;

  function open(index: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpenIndex(index);
  }

  return (
    <>
      <PhotoGridLayout photoUrls={photoUrls} onOpen={open} />
      {openIndex !== null ? (
        <Lightbox src={fullUrls[openIndex] ?? photoUrls[openIndex] ?? ""} onClose={() => setOpenIndex(null)} />
      ) : null}
    </>
  );
}

function PhotoGridLayout({
  photoUrls,
  onOpen,
}: {
  photoUrls: string[];
  onOpen: (index: number, e: React.MouseEvent) => void;
}) {
  if (photoUrls.length === 1) {
    return (
      <div className="mt-2.5 overflow-hidden rounded-2xl bg-paper-deep">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrls[0]}
          alt=""
          loading="lazy"
          decoding="async"
          onClick={(e) => onOpen(0, e)}
          className="max-h-96 w-full cursor-zoom-in object-cover"
        />
      </div>
    );
  }

  if (photoUrls.length === 2) {
    return (
      <div className="mt-2.5 grid aspect-[16/9] grid-cols-2 gap-1 overflow-hidden rounded-2xl">
        {photoUrls.map((url, i) => (
          <div key={i} className="h-full w-full bg-paper-deep">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              onClick={(e) => onOpen(i, e)}
              className="h-full w-full cursor-zoom-in object-cover"
            />
          </div>
        ))}
      </div>
    );
  }

  if (photoUrls.length === 3) {
    return (
      <div className="mt-2.5 grid aspect-[4/3] grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-2xl">
        <div className="row-span-2 h-full w-full bg-paper-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrls[0]}
            alt=""
            loading="lazy"
            decoding="async"
            onClick={(e) => onOpen(0, e)}
            className="h-full w-full cursor-zoom-in object-cover"
          />
        </div>
        {photoUrls.slice(1).map((url, i) => (
          <div key={i} className="h-full w-full bg-paper-deep">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              onClick={(e) => onOpen(i + 1, e)}
              className="h-full w-full cursor-zoom-in object-cover"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2.5 grid aspect-square grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-2xl">
      {photoUrls.map((url, i) => (
        <div key={i} className="h-full w-full bg-paper-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            onClick={(e) => onOpen(i, e)}
            className="h-full w-full cursor-zoom-in object-cover"
          />
        </div>
      ))}
    </div>
  );
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="写真を拡大表示"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white"
      >
        <IconClose size={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
