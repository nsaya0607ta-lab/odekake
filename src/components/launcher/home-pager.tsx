"use client";

/**
 * ホームを横にスワイプして、ページを切りかえる（iPhone のホーム画面と同じさわり心地）。
 *   0: ホーム（いつもの画面） → 1〜: アプリの画面（launcher.tsx。入りきらなければ2枚目、3枚目…） → 最後: 背景をながめる（背景を変えているときだけ）
 *
 * - 指に吸いつくように動き、はしでは引っぱるほど重くなる（ゴムのような手ごたえ）
 * - はなすと、指の速さを引きついだバネの動きで、となりのページへ（1回で動くのは1ページまで）
 * - ホームのヘッダーとページは左へ流れ、アプリの画面が右から入る。下のナビは、背景のページでだけ消える
 * - 横に動かせる部品（カルーセルなど）の上で始めたスワイプは、その部品にまかせる
 * - 下のナビの「ホーム」・Esc で、ホームへもどる。トラックパッドの横スクロール・左右キーでも動かせる
 * - アプリの画面から開いたページから戻ってきたときは、アプリの画面のまま開く（iPhone と同じ）
 */
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clearLaunch, homePageToRestore, readLaunch, rememberHomePage } from "@/lib/launcher-return";
import { lockPageScroll } from "@/lib/scroll-lock";
import { Launcher, type LauncherData } from "./launcher";
import styles from "./launcher.module.css";

/** これだけ動いたら、縦か横かを決める（px） */
const DECIDE_PX = 8;
/** 画面のはしからこの幅の中で始まったスワイプは、ブラウザの「戻る」にまかせる（px） */
const EDGE_PX = 20;

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

/** はしで引っぱったときの重さ（iPhone と同じ式） */
const rubber = (over: number, dim: number) => (1 - 1 / ((Math.abs(over) * 0.55) / dim + 1)) * dim * Math.sign(over);

export function HomePager({ data, sns, memoryGame, gaze }: { data: LauncherData; sns: boolean; memoryGame: boolean; gaze: boolean }) {
  const pathname = usePathname();
  /** アプリの画面の枚数（アイコンの数と画面の高さで決まる。launcher.tsx から教えてもらう） */
  const [appPages, setAppPages] = useState(1);
  const appPagesRef = useRef(1);
  appPagesRef.current = appPages;
  const pageCount = 1 + appPages + (gaze ? 1 : 0);
  const maxPage = pageCount - 1;
  const gazePage = gaze ? 1 + appPages : -1;
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hint, setHint] = useState(false);
  /** アプリの画面を前もって組み立てておく（はじめてスワイプしたとき、アイコンの絵がもう読みこまれているように） */
  const [warm, setWarm] = useState(false);
  const [returnFrom, setReturnFrom] = useState<string | null>(null);
  const launcherRef = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  const anim = useRef<{ raf: number } | null>(null);
  const blocked = useRef(false);
  const options = useMemo(() => ({ sns, memoryGame }), [sns, memoryGame]);

  /** p（ページの位置。0〜maxPage、はしは少しはみ出す）に合わせて、画面を動かす */
  const apply = useCallback(
    (p: number) => {
      pos.current = p;
      const w = window.innerWidth || 1;
      const header = document.querySelector<HTMLElement>("header.sticky");
      const main = document.querySelector<HTMLElement>("main");
      const nav = document.querySelector<HTMLElement>(".app-bottom-nav");
      const launcher = launcherRef.current;
      const home = Math.max(-0.3, Math.min(p, 1.2));
      if (p === 0) {
        for (const el of [header, main, nav]) {
          el?.style.removeProperty("transform");
          el?.style.removeProperty("opacity");
          el?.style.removeProperty("pointer-events");
          el?.style.removeProperty("will-change");
        }
      } else {
        for (const el of [header, main]) {
          if (!el) continue;
          el.style.setProperty("transform", `translate3d(${-home * w}px,0,0)`, "important");
          el.style.setProperty("will-change", "transform");
          el.style.setProperty("pointer-events", "none");
        }
        // 背景のページへ向かうほど、下のナビを消す
        const fade = Math.max(0, Math.min(1, p - appPagesRef.current));
        if (nav) {
          nav.style.setProperty("opacity", String(1 - fade), "important");
          nav.style.setProperty("transform", `translate3d(0,${fade * 24}px,0)`, "important");
          nav.style.setProperty("pointer-events", fade > 0.5 ? "none" : "auto");
        }
      }
      if (launcher) {
        const last = appPagesRef.current;
        launcher.style.transform = `translate3d(${(1 - p) * w}px,0,0)`;
        // 下の検索とページの点は、アプリの画面のページをめくっても動かない（iPhone と同じ）
        launcher.style.setProperty("--pageX", `${Math.max(0, Math.min(last - 1, p - 1)) * w}px`);
        launcher.style.visibility = p > 0.001 && p < last + 0.999 ? "visible" : "hidden";
      }
    },
    [],
  );

  /** バネの動きで target へ（v は指をはなしたときの速さ。ページ/秒） */
  const springTo = useCallback(
    (target: number, v0 = 0) => {
      if (anim.current) cancelAnimationFrame(anim.current.raf);
      const k = 290, c = 2 * Math.sqrt(k) * 0.86;
      let x = pos.current, v = v0, last = performance.now();
      setVisible(true);
      const tick = (now: number) => {
        const dt = Math.min(0.032, (now - last) / 1000);
        last = now;
        // 小さく区切って計算する（速い端末でも遅い端末でも同じ動きに）
        for (let i = 0; i < 4; i++) {
          const h = dt / 4;
          const a = -k * (x - target) - c * v;
          v += a * h;
          x += v * h;
        }
        if (Math.abs(x - target) < 0.0006 && Math.abs(v) < 0.01) {
          apply(target);
          anim.current = null;
          setPage(target);
          setVisible(target > 0);
          rememberHomePage(target <= appPagesRef.current ? target : 0);
          return;
        }
        apply(x);
        anim.current = { raf: requestAnimationFrame(tick) };
      };
      anim.current = { raf: requestAnimationFrame(tick) };
    },
    [apply],
  );

  const goPage = useCallback((target: number, v0 = 0) => springTo(Math.max(0, Math.min(maxPage, target)), v0), [springTo, maxPage]);

  // ほかのページから戻ってきたとき：アプリの画面にいたなら、アプリの画面のまま開く（画面がアイコンへもどる動きつき）
  useLayoutEffect(() => {
    const launched = readLaunch();
    clearLaunch();
    const restore = homePageToRestore();
    if (restore < 1) return;
    setReturnFrom(launched?.id ?? null);
    setVisible(true);
    setPage(restore);
    apply(restore);
  }, [apply]);

  useEffect(() => {
    // Safari には requestIdleCallback がないので、そのときは少し待ってから
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setWarm(true), { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setWarm(true), 1200);
    return () => window.clearTimeout(id);
  }, []);

  // ページがホーム以外のあいだは、うしろのページをスクロールさせない
  useEffect(() => {
    if (!visible) return;
    return lockPageScroll();
  }, [visible]);

  // 背景のページに来たら、少しだけ案内を出す
  useEffect(() => {
    if (page !== gazePage) return;
    setHint(true);
    const id = window.setTimeout(() => setHint(false), 2600);
    return () => window.clearTimeout(id);
  }, [page, gazePage]);

  // 横スワイプ
  useEffect(() => {
    type Drag = { x: number; y: number; start: number; axis: "x" | "y" | null; samples: { x: number; t: number }[] };
    let drag: Drag | null = null;

    const begin = (x: number, y: number, target: EventTarget | null) => {
      if (blocked.current) return;
      const onHome = pos.current < 0.5;
      if (onHome && ownsHorizontalSwipe(target)) return;
      if (x < EDGE_PX || x > window.innerWidth - EDGE_PX) return;
      if (anim.current) {
        // 動いている途中でつかんだら、その場で止めて指に従う（iPhone と同じ）
        cancelAnimationFrame(anim.current.raf);
        anim.current = null;
      }
      drag = { x, y, start: pos.current, axis: null, samples: [{ x, t: performance.now() }] };
    };

    const move = (x: number, y: number, event: Event) => {
      if (!drag) return;
      if (blocked.current) {
        // 長押しのメニューなどが出たら、ページの動きはやめてもとの場所へ
        const start = Math.round(drag.start);
        drag = null;
        goPage(start);
        return;
      }
      const dx = x - drag.x, dy = y - drag.y;
      if (!drag.axis) {
        if (Math.hypot(dx, dy) < DECIDE_PX) return;
        drag.axis = Math.abs(dx) > Math.abs(dy) * 1.1 ? "x" : "y";
        if (drag.axis === "x") setVisible(true);
      }
      if (drag.axis !== "x") return;
      if (event.cancelable) event.preventDefault();
      const w = window.innerWidth || 1;
      let p = drag.start - dx / w;
      if (p < 0) p = -rubber(-p * w, w) / w;
      else if (p > maxPage) p = maxPage + rubber((p - maxPage) * w, w) / w;
      apply(p);
      drag.samples.push({ x, t: performance.now() });
      if (drag.samples.length > 6) drag.samples.shift();
    };

    const end = () => {
      const d = drag;
      drag = null;
      if (!d || d.axis !== "x") {
        if (d && pos.current === 0) setVisible(false);
        return;
      }
      const w = window.innerWidth || 1;
      const first = d.samples[0]!, last = d.samples[d.samples.length - 1]!;
      const dt = Math.max(1, last.t - first.t);
      const vPages = (-(last.x - first.x) / dt) * 1000 / w; // ページ/秒（左へはらうと＋）
      let target = Math.round(pos.current);
      if (Math.abs(vPages) > 0.35) target = vPages > 0 ? Math.floor(d.start) + 1 : Math.ceil(d.start) - 1;
      target = Math.max(Math.round(d.start) - 1, Math.min(Math.round(d.start) + 1, target));
      goPage(target, Math.max(-6, Math.min(6, vPages)));
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { drag = null; return; }
      const t = e.touches[0]!;
      begin(t.clientX, t.clientY, e.target);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0]!;
      move(t.clientX, t.clientY, e);
    };
    // パソコン：アプリの画面と背景のページでは、マウスでもつかんで動かせる
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || pos.current < 0.5) return;
      begin(e.clientX, e.clientY, e.target);
    };
    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY, e);
    // トラックパッドの横スクロール
    let wheelAcc = 0, wheelLock = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || blocked.current) return;
      if (pos.current < 0.5 && ownsHorizontalSwipe(e.target)) return;
      const now = performance.now();
      if (now < wheelLock) return;
      wheelAcc += e.deltaX;
      if (Math.abs(wheelAcc) > 70) {
        goPage(Math.round(pos.current) + Math.sign(wheelAcc));
        wheelAcc = 0;
        wheelLock = now + 650;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (blocked.current || (e.target instanceof HTMLElement && e.target.closest("input, textarea"))) return;
      if (e.key === "Escape" && pos.current > 0) goPage(0);
      if (pos.current > 0.5 && e.key === "ArrowRight") goPage(Math.round(pos.current) + 1);
      if (pos.current > 0.5 && e.key === "ArrowLeft") goPage(Math.round(pos.current) - 1);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", end, { passive: true });
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", end);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [apply, goPage, maxPage]);

  // 下のナビの「ホーム」を押したら、ホームのページへもどる（ページの読みこみはしない）
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('.app-bottom-nav a[href="/home"]') : null;
      if (!a || pos.current === 0) return;
      e.preventDefault();
      goPage(0);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [goPage]);

  // ほかのページへ移るとき・はずすときは、動かした画面をもとにもどす
  const homePath = useRef(pathname);
  useEffect(() => {
    if (pathname !== homePath.current) apply(0);
  }, [pathname, apply]);
  useEffect(() => () => apply(0), [apply]);

  // アプリの画面の枚数が変わったら（アイコンを非表示にした・ページの外へ出たときなど）、はみ出したページから戻す
  const onAppPages = useCallback(
    (n: number) => {
      const pages = Math.max(1, n);
      if (pages === appPagesRef.current) return;
      appPagesRef.current = pages;
      setAppPages(pages);
      const max = pages + (gaze ? 1 : 0);
      if (!anim.current && pos.current > max) springTo(max);
      else if (!anim.current && pos.current > 0) apply(pos.current);
    },
    [gaze, springTo, apply],
  );

  const onBlockSwipe = useCallback((b: boolean) => {
    blocked.current = b;
  }, []);

  return (
    <>
      <div
        ref={launcherRef}
        className={styles.root}
        style={{ transform: "translate3d(100vw,0,0)", visibility: "hidden" }}
        aria-hidden={page !== 1}
        role="region"
        aria-label="アプリ"
      >
        {visible || warm ? (
          <Launcher options={options} data={data} page={page} pageCount={pageCount} returnFrom={returnFrom} onBlockSwipe={onBlockSwipe} onGoPage={goPage} onAppPages={onAppPages} />
        ) : null}
      </div>
      {gaze ? (
        <div className={styles.gazeHint} style={{ bottom: "calc(var(--safe-bottom) + 28px)", opacity: hint ? 1 : 0 }} aria-live="polite">
          <span>背景をながめています ・ 右へスワイプでもどる</span>
        </div>
      ) : null}
    </>
  );
}
