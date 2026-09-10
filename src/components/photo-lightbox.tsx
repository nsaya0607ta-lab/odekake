"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronLeft, IconChevronRight, IconClose } from "@/components/icons";

/**
 * 写真をタップしたときに、元の縦横比のまま全画面で拡大表示する。
 * サムネイルは object-cover で切り抜かれるが、ここでは object-fit: contain のため
 * 16:9などどんな縦横比の写真でも正しい比率で見える。
 */
export function PhotoLightbox({
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
  const [zoom, setZoom] = useState(1);
  const gestureRef = useRef({ startX: 0, startDistance: 0, startZoom: 1 });

  useEffect(() => setZoom(1), [index]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (urls.length > 1 && event.key === "ArrowLeft") {
        onIndexChange((index - 1 + urls.length) % urls.length);
      }
      if (urls.length > 1 && event.key === "ArrowRight") {
        onIndexChange((index + 1) % urls.length);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [index, onClose, onIndexChange, urls.length]);

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

  function distance(touches: React.TouchList): number {
    if (touches.length < 2) return 0;
    const first = touches.item(0);
    const second = touches.item(1);
    if (!first || !second) return 0;
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  }

  function handleTouchStart(event: React.TouchEvent) {
    event.stopPropagation();
    if (event.touches.length === 2) {
      gestureRef.current.startDistance = distance(event.touches);
      gestureRef.current.startZoom = zoom;
    } else if (event.touches.length === 1) {
      gestureRef.current.startX = event.touches[0]?.clientX ?? 0;
    }
  }

  function handleTouchMove(event: React.TouchEvent) {
    event.stopPropagation();
    if (event.touches.length === 2 && gestureRef.current.startDistance > 0) {
      event.preventDefault();
      const ratio = distance(event.touches) / gestureRef.current.startDistance;
      setZoom(Math.min(3.5, Math.max(1, gestureRef.current.startZoom * ratio)));
    }
  }

  function handleTouchEnd(event: React.TouchEvent) {
    event.stopPropagation();
    if (zoom > 1 || urls.length < 2 || event.changedTouches.length !== 1) return;
    const endX = event.changedTouches[0]?.clientX ?? gestureRef.current.startX;
    const delta = endX - gestureRef.current.startX;
    if (Math.abs(delta) < 48) return;
    onIndexChange(delta > 0 ? (index - 1 + urls.length) % urls.length : (index + 1) % urls.length);
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="写真を拡大表示" onClick={close} className="sns-lightbox">
      <button type="button" onClick={close} aria-label="閉じる" className="sns-lightbox-control is-close pressable">
        <IconClose size={20} />
      </button>

      {urls.length > 1 ? (
        <>
          <button type="button" onClick={goPrev} aria-label="前の写真" className="sns-lightbox-control is-prev pressable">
            <IconChevronLeft size={22} />
          </button>
          <button type="button" onClick={goNext} aria-label="次の写真" className="sns-lightbox-control is-next pressable">
            <IconChevronRight size={22} />
          </button>
          <span className="sns-lightbox-counter" aria-live="polite">
            {index + 1} / {urls.length}
          </span>
        </>
      ) : null}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[index]}
        alt=""
        className="sns-lightbox-image"
        style={{ transform: `scale(${zoom})` }}
        onClick={stop}
        onDoubleClick={(event) => {
          stop(event);
          setZoom((value) => (value > 1 ? 1 : 2.25));
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>,
    document.body,
  );
}
