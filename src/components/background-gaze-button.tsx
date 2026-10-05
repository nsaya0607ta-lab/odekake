"use client";

import { useEffect, useState } from "react";

/**
 * 背景をながめるモード（ホームの右下のボタン）。
 * ヘッダー・カード・下のナビをかくして、背景だけを画面いっぱいに見せる。
 * さわれる背景は、そのまま画面をタップして遊べる。もどるボタンか Esc でもとにもどる。
 */
export function BackgroundGazeButton() {
  const [gazing, setGazing] = useState(false);

  useEffect(() => {
    if (!gazing) return;
    const root = document.documentElement;
    root.setAttribute("data-gaze", "");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGazing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.removeAttribute("data-gaze");
      window.removeEventListener("keydown", onKey);
    };
  }, [gazing]);

  if (gazing) {
    return (
      <div className="fixed inset-x-0 z-[60] flex justify-center px-4" style={{ bottom: "calc(var(--safe-bottom) + 20px)" }}>
        <div className="flex items-center gap-2 rounded-full border border-white/70 bg-[rgba(255,253,248,.82)] py-1.5 pl-4 pr-1.5 shadow-[0_8px_24px_rgba(60,45,25,.18)] backdrop-blur-md">
          <span className="text-[12px] font-bold text-ink-soft">背景をながめています</span>
          <button
            type="button"
            onClick={() => setGazing(false)}
            className="rounded-full bg-leaf px-4 py-1.5 text-[12px] font-black text-white active:scale-95"
          >
            もどる
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setGazing(true)}
      aria-label="背景をながめる"
      className="fixed right-3 z-[35] flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-[rgba(255,253,248,.78)] text-leaf-deep shadow-[0_6px_16px_rgba(60,45,25,.16)] backdrop-blur-md active:scale-95"
      style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 12px)" }}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    </button>
  );
}
