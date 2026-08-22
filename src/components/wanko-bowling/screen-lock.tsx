"use client";

import { useEffect } from "react";

/** ボウリング中は背面のアプリ画面を固定し、投球ジェスチャーをiOS側へ漏らさない。 */
export function BowlingScreenLock() {
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;

    const previous = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    };

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overscrollBehavior = "none";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";

    // iOS SafariではPointerEventのpreventDefaultだけでは、親のスクロールや
    // ラバーバンドが動く場合がある。投球レーン上のtouchmoveだけをnativeの
    // capture段階で止め、ゲーム外のスクロール操作には影響させない。
    const blockLaneTouchMove = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('[data-bowling-gesture-block="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("touchmove", blockLaneTouchMove, { passive: false, capture: true });

    return () => {
      document.removeEventListener("touchmove", blockLaneTouchMove, true);
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, []);

  return null;
}
