"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { getFriendTextPostFullPhotoUrlsAction, setFriendTextPostLikeAction } from "@/app/actions/sns";
import { IconChevronLeft, IconChevronRight, IconClose, IconHeart } from "@/components/icons";

/**
 * つぶやきに添付された写真（最大4枚）をTwitterのようなグリッドで並べる。
 * 転送量を抑えるため、グリッドに出す画像は常にサムネイル（-thumb）。
 * タップすると原寸（アップロード時に圧縮済みの本画像）を初めて読み込み、
 * 全画面で拡大表示する — 原寸は開いたときだけ読み込まれる
 */
export function SnsPostPhotoGrid({
  photoUrls,
  photoPaths = [],
  postId,
  authorUserId,
  liked = false,
}: {
  photoUrls: string[];
  photoPaths?: string[];
  postId?: string;
  authorUserId?: string;
  liked?: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [heartBurst, setHeartBurst] = useState(false);
  const [locallyLiked, setLocallyLiked] = useState(liked);
  const [fullUrls, setFullUrls] = useState<string[] | null>(null);
  const [loadingOriginals, startLoadingOriginals] = useTransition();
  const [, startTransition] = useTransition();
  const lastTapRef = useRef(0);
  const openTimerRef = useRef<number | null>(null);

  useEffect(() => setLocallyLiked(liked), [liked]);
  useEffect(() => () => {
    if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
  }, []);

  if (photoUrls.length === 0) return null;

  function loadOriginals() {
    if (!postId || fullUrls || loadingOriginals || photoPaths.length !== photoUrls.length) return;
    startLoadingOriginals(async () => {
      const result = await getFriendTextPostFullPhotoUrlsAction(postId);
      if (!result.ok) return;
      const resolved = photoPaths.map((path) => result.urls[path]).filter((url): url is string => Boolean(url));
      if (resolved.length === photoUrls.length) setFullUrls(resolved);
    });
  }

  function showLightbox(index: number) {
    setOpenIndex(index);
    loadOriginals();
  }

  function open(index: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < 300;
    lastTapRef.current = now;

    if (isDoubleTap && postId && authorUserId) {
      if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
      setHeartBurst(false);
      requestAnimationFrame(() => setHeartBurst(true));
      window.setTimeout(() => setHeartBurst(false), 720);
      if (!locallyLiked) {
        setLocallyLiked(true);
        if ("vibrate" in navigator) navigator.vibrate?.(12);
        startTransition(async () => {
          const formData = new FormData();
          formData.set("postId", postId);
          formData.set("authorUserId", authorUserId);
          formData.set("liked", "1");
          await setFriendTextPostLikeAction(formData);
        });
      }
      return;
    }

    if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
    openTimerRef.current = window.setTimeout(() => showLightbox(index), postId && authorUserId ? 230 : 0);
  }

  return (
    <>
      <div className="sns-post-photo-stage">
        <PhotoGridLayout photoUrls={photoUrls} onOpen={open} />
        {heartBurst ? (
          <span className="sns-photo-heart-burst" aria-hidden="true"><IconHeart size={66} filled /></span>
        ) : null}
      </div>
      {openIndex !== null ? (
        <Lightbox
          urls={fullUrls ?? photoUrls}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          loadingOriginals={loadingOriginals}
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
  loadingOriginals,
}: {
  urls: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  loadingOriginals: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const gestureRef = useRef({ startX: 0, startDistance: 0, startZoom: 1 });

  useEffect(() => setZoom(1), [index]);
  // 背景のスクロール・タップを完全に止める（body固定 + Portalでリンクの外に出す）
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="写真を拡大表示"
      onClick={close}
      className="sns-lightbox"
    >
      {loadingOriginals ? <span className="sns-lightbox-loading" role="status">高画質を読み込み中…</span> : null}
      <button
        type="button"
        onClick={close}
        aria-label="閉じる"
        className="sns-lightbox-control is-close pressable"
      >
        <IconClose size={20} />
      </button>

      {urls.length > 1 ? (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="前の写真"
            className="sns-lightbox-control is-prev pressable"
          >
            <IconChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="次の写真"
            className="sns-lightbox-control is-next pressable"
          >
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
          setZoom((value) => value > 1 ? 1 : 2.25);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>,
    document.body,
  );
}
