"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function internalHrefFromAnchor(anchor: HTMLAnchorElement): string | null {
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  if (!anchor.href) return null;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * アプリ全体のタップ反応を速く感じられるようにする共通フィードバック。
 *
 * - 内部リンクは pointerdown の時点で prefetch を開始する
 * - タップ直後に上部の進捗バーを出す
 * - 押したリンク自身にも pending 表示を付ける
 * - 画面遷移完了時に自動で解除する
 *
 * force-dynamic 画面が多いため、全リンクを常時 prefetch するとDB負荷が増える。
 * 実際に指が触れたリンクだけを先読みすることで、負荷を抑えつつ待ち時間を短縮する。
 */
export function GlobalInteractionFeedback() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const activeElement = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setPending(false);
    activeElement.current?.removeAttribute("data-navigation-pending");
    activeElement.current = null;
    document.documentElement.removeAttribute("data-navigation-pending");
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, [pathname, searchParams]);

  useEffect(() => {
    const startFeedback = (element: HTMLElement) => {
      activeElement.current?.removeAttribute("data-navigation-pending");
      activeElement.current = element;
      element.setAttribute("data-navigation-pending", "true");
      document.documentElement.setAttribute("data-navigation-pending", "true");
      setPending(true);

      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setPending(false);
        element.removeAttribute("data-navigation-pending");
        document.documentElement.removeAttribute("data-navigation-pending");
      }, 8000);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = internalHrefFromAnchor(anchor);
      if (!href) return;
      router.prefetch(href);
      if (anchor.dataset.haptic === "light") navigator.vibrate?.(6);
      anchor.setAttribute("data-pressed", "true");
    };

    const onPointerUp = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      target?.closest("a[href], button, [role='button']")?.removeAttribute("data-pressed");
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = internalHrefFromAnchor(anchor);
      if (!href) return;
      startFeedback(anchor);
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form) return;
      const submitter = event.submitter instanceof HTMLElement ? event.submitter : form;
      startFeedback(submitter);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerUp, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerUp, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [router]);

  return pending ? (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[3px] overflow-hidden bg-leaf-soft/70" aria-hidden="true">
      <span className="route-progress block h-full w-1/3 bg-leaf-deep" />
    </div>
  ) : null;
}
