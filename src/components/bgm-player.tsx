"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "odekake-bgm-muted";

/**
 * アプリ起動時にBGMをループ再生する。
 * ブラウザの自動再生制限があるため、即時再生を試みつつ、
 * ブロックされた場合は最初のユーザー操作で再生を開始する。
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

    const tryPlay = () => {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
      audio.play().catch(() => {
        // 自動再生がブロックされた場合は、最初のユーザー操作で再試行する
        const resume = () => {
          audio.play().catch(() => {});
          window.removeEventListener("pointerdown", resume);
          window.removeEventListener("keydown", resume);
        };
        window.addEventListener("pointerdown", resume, { once: true });
        window.addEventListener("keydown", resume, { once: true });
      });
    };

    tryPlay();
  }, []);

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    setMuted(next);
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    if (next) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  return (
    <>
      <audio ref={audioRef} src="/audio/bgm.wav" loop preload="auto" />
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "BGMを再生する" : "BGMを止める"}
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
