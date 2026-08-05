"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const MAIN_ROUTES = ["/home", "/map", "/add", "/records", "/mypage", "/workspaces"];

/**
 * スマホで次の画面を押してから待たされないよう、主要画面と
 * ユーザーが触れようとしている内部リンクを先に読み込む。
 */
export function RoutePreloader() {
  const router = useRouter();
  const pathname = usePathname();
  const prefetched = useRef(new Set<string>());

  useEffect(() => {
    const prefetch = (href: string) => {
      if (!href.startsWith("/") || href === pathname || prefetched.current.has(href)) return;
      prefetched.current.add(href);
      router.prefetch(href);
    };

    // 初期表示を妨げないよう少し待ってから、下部ナビの行き先を温める。
    const timer = window.setTimeout(() => {
      for (const href of MAIN_ROUTES) prefetch(href);
    }, 180);

    const warmTarget = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      prefetch(`${url.pathname}${url.search}`);
    };

    // pointerover はマウス、touchstart はスマホの指が触れた瞬間に動く。
    document.addEventListener("pointerover", warmTarget, { passive: true });
    document.addEventListener("touchstart", warmTarget, { passive: true });

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerover", warmTarget);
      document.removeEventListener("touchstart", warmTarget);
    };
  }, [pathname, router]);

  return null;
}
