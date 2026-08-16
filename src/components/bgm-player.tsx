"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "odekake-bgm-muted";

/**
 * アプリ起動時にBGMをループ再生し、タップ操作には効果音を鳴らす。
 *
 * - ブラウザの自動再生制限があるため、即時再生を試みつつ、
 *   ブロックされた場合は最初のユーザー操作で再生を開始する
 * - タブが非表示(他アプリ切り替え・スリープ等)になったらBGMを一時停止し、
 *   戻ってきたら再開する。サイトを閉じている間は鳴らさない
 */
export function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setMuted(stored === "1");
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.35;

    const isMuted = () => window.localStorage.getItem(STORAGE_KEY) === "1";

    const tryPlay = () => {
      if (isMuted() || document.visibilityState !== "visible") return;
      audio.play().catch(() => {
        // 自動再生がブロックされた場合は、最初のユーザー操作で再試行する
        const resume = () => {
          tryPlay();
          window.removeEventListener("pointerdown", resume);
          window.removeEventListener("keydown", resume);
        };
        window.addEventListener("pointerdown", resume, { once: true });
        window.addEventListener("keydown", resume, { once: true });
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        tryPlay();
      } else {
        audio.pause();
      }
    };

    tryPlay();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // タップした要素(ボタン・リンク)ごとに軽い操作音を鳴らす
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("a[href], button, [role='button']")) return;
      const tap = new Audio("/audio/tap.mp3");
      tap.volume = 1.0;
      tap.play().catch(() => {});
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    setMuted(next);
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    if (next) {
      audio.pause();
    } else if (document.visibilityState === "visible") {
      audio.play().catch(() => {});
    }
  };

  return (
    <>
      <audio ref={audioRef} src="/audio/bgm.mp3" loop preload="auto" />
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "サウンドを再生する" : "サウンドを止める"}
        aria-pressed={muted}
        style={{
          position: "fixed",
          right: "12px",
          bottom: "calc(var(--nav-height, 0px) + var(--safe-bottom, 0px) + 12px)",
          zIndex: 40,
          width: "40px",
          height: "40px",
          borderRadius: "9999px",
          border: "1px solid rgba(0,0,0,0.08)",
          background: "rgba(255,255,255,0.9)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "18px",
          lineHeight: 1,
        }}
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </>
  );
}
