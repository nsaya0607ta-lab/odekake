"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 背景をながめるモード（ホームの右下のボタン、またはホームを横にスワイプ）。
 * ヘッダー・カード・下のナビをかくして、背景だけを画面いっぱいに見せる。
 * さわれる背景は、そのまま画面をタップして遊べる。もどるボタン・もう一度横スワイプ・Esc でもとにもどる。
 *
 * スワイプ中は、指に合わせて画面（ヘッダー・ページ・ナビ）を横にずらし、だんだん透かす。
 * 画面の幅の 28% 以上、またはすばやくはらったら、そのまま横へ流してながめるモードにする。
 * 横に動かせる部品（カルーセルなど）の上で始めたスワイプは、その部品にまかせる。
 */

/** これだけ動いたら、縦か横かを決める（px） */
const DECIDE_PX = 10;
/** 画面の幅のこの割合を超えたら、はなしたときに切りかえる */
const COMMIT_RATIO = 0.28;
/** これより速くはらったら、短くても切りかえる（px/ms） */
const FLICK_SPEED = 0.45;
const SLIDE_MS = 420;
/** 画面のはしからこの幅の中で始まったスワイプは使わない（px） */
const EDGE_PX = 24;

type Drag = { x: number; y: number; t: number; axis: "x" | "y" | null; dx: number };

/** 指を置いた場所が、横スワイプを自分で使う部品の中か */
function ownsHorizontalSwipe(target: EventTarget | null): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.hasAttribute("data-gaze-swipe-ignore")) return true;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
  }
  return false;
}

export function BackgroundGazeButton() {
  const [gazing, setGazing] = useState(false);
  const gazingRef = useRef(false);
  gazingRef.current = gazing;

  // ながめるモードの出入り（スワイプでもボタンでも同じ）
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

  // 横スワイプ
  useEffect(() => {
    const root = document.documentElement;
    let drag: Drag | null = null;
    let settleTimer = 0;

    const setOffset = (dx: number) => {
      const w = window.innerWidth || 1;
      // ながめている最中は、画面の外（スワイプしてきた側）から指に合わせて戻ってくる
      const out = Number(root.style.getPropertyValue("--gaze-out").replace("px", "")) || w;
      const shown = gazingRef.current ? Math.sign(out) * Math.max(0, Math.abs(out) - Math.abs(dx)) : dx;
      root.style.setProperty("--gaze-dx", `${shown}px`);
      root.style.setProperty("--gaze-alpha", `${Math.max(0, 1 - Math.abs(shown) / (w * 0.75))}`);
    };

    const settle = (done: () => void) => {
      // 指をはなしたあとの動き（CSS の transition）が終わってから、状態をそろえる
      root.setAttribute("data-gaze-settle", "");
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        // 先に次の状態をつけてから外す（あいだの1コマで画面がもとの場所に見えないように）
        done();
        root.removeAttribute("data-gaze-settle");
      }, SLIDE_MS);
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || root.hasAttribute("data-gaze-settle") || ownsHorizontalSwipe(event.target)) {
        drag = null;
        return;
      }
      const touch = event.touches[0]!;
      // 画面のはしから始まるスワイプは、ブラウザの「戻る」にまかせる
      if (touch.clientX < EDGE_PX || touch.clientX > window.innerWidth - EDGE_PX) {
        drag = null;
        return;
      }
      drag = { x: touch.clientX, y: touch.clientY, t: performance.now(), axis: null, dx: 0 };
    };

    const onMove = (event: TouchEvent) => {
      if (!drag || event.touches.length !== 1) return;
      const touch = event.touches[0]!;
      const dx = touch.clientX - drag.x;
      const dy = touch.clientY - drag.y;
      if (!drag.axis) {
        if (Math.hypot(dx, dy) < DECIDE_PX) return;
        drag.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
        if (drag.axis === "x") root.setAttribute("data-gaze-drag", "");
      }
      if (drag.axis !== "x") return;
      if (event.cancelable) event.preventDefault();
      drag.dx = dx;
      setOffset(dx);
    };

    const onEnd = () => {
      const d = drag;
      drag = null;
      if (!d || d.axis !== "x") return;
      const w = window.innerWidth || 1;
      const speed = Math.abs(d.dx) / Math.max(1, performance.now() - d.t);
      const commit = Math.abs(d.dx) > w * COMMIT_RATIO || (speed > FLICK_SPEED && Math.abs(d.dx) > 30);
      root.removeAttribute("data-gaze-drag");

      if (!gazingRef.current) {
        if (commit) {
          // スワイプした向きへ流して、ながめるモードへ
          const out = Math.sign(d.dx) * w;
          root.style.setProperty("--gaze-out", `${out}px`);
          root.style.setProperty("--gaze-dx", `${out}px`);
          root.style.setProperty("--gaze-alpha", "0");
          settle(() => {
            root.setAttribute("data-gaze", "");
            setGazing(true);
          });
        } else {
          root.style.setProperty("--gaze-dx", "0px");
          root.style.setProperty("--gaze-alpha", "1");
          settle(() => {});
        }
        return;
      }

      if (commit) {
        // 外にいた画面を、もとの場所へ戻す
        root.style.setProperty("--gaze-dx", "0px");
        root.style.setProperty("--gaze-alpha", "1");
        root.removeAttribute("data-gaze");
        settle(() => setGazing(false));
      } else {
        const out = root.style.getPropertyValue("--gaze-out") || `${w}px`;
        root.style.setProperty("--gaze-dx", out);
        root.style.setProperty("--gaze-alpha", "0");
        settle(() => {});
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      window.clearTimeout(settleTimer);
      root.removeAttribute("data-gaze-drag");
      root.removeAttribute("data-gaze-settle");
      root.style.removeProperty("--gaze-dx");
      root.style.removeProperty("--gaze-alpha");
      root.style.removeProperty("--gaze-out");
    };
  }, []);

  // ボタンでの出入りは、ずらさずにふわっと消す・出す
  const toggle = (next: boolean) => {
    const root = document.documentElement;
    root.style.setProperty("--gaze-out", "0px");
    setGazing(next);
  };

  if (gazing) {
    return (
      <div className="fixed inset-x-0 z-[60] flex justify-center px-4" style={{ bottom: "calc(var(--safe-bottom) + 20px)" }}>
        <div className="flex items-center gap-2 rounded-full border border-white/70 bg-[rgba(255,253,248,.82)] py-1.5 pl-4 pr-1.5 shadow-[0_8px_24px_rgba(60,45,25,.18)] backdrop-blur-md">
          <span className="text-[12px] font-bold text-ink-soft">背景をながめています</span>
          <button
            type="button"
            onClick={() => toggle(false)}
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
      onClick={() => toggle(true)}
      aria-label="背景をながめる（ホームを横にスワイプしてもながめられます）"
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
