"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronLeft, IconChevronRight, IconClose } from "@/components/icons";

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
        <Lightbox
          urls={fullUrls.length === photoUrls.length ? fullUrls : photoUrls}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
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

function Lightbox({
  urls,
  index,
  onIndexChange,
  onClose,
}: {
  urls: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  // 背景のスクロール・タップを完全に止める（body固定 + Portalでリンクの外に出す）
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  function stop(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function close(e: React.SyntheticEvent) {
    stop(e);
    onClose();
  }

  function goPrev(e: React.SyntheticEvent) {
    stop(e);
    onIndexChange((index - 1 + urls.length) % urls.length);
  }

  function goNext(e: React.SyntheticEvent) {
    stop(e);
    onIndexChange((index + 1) % urls.length);
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="写真を拡大表示"
      onClick={close}
      onTouchMove={stop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
    >
      <button
        type="button"
        onClick={close}
        aria-label="閉じる"
        className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white"
      >
        <IconClose size={20} />
      </button>

      {urls.length > 1 ? (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="前の写真"
            className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <IconChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="次の写真"
            className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <IconChevronRight size={22} />
          </button>
          <span className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
            {index + 1} / {urls.length}
          </span>
        </>
      ) : null}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urls[index]} alt="" className="max-h-full max-w-full object-contain" onClick={stop} />
    </div>,
    document.body,
  );
}
