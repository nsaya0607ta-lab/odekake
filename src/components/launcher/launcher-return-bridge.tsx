"use client";

/**
 * アプリの画面から開いたページの「戻る」（〜へ戻る のリンク）を、アプリの画面へもどすようにする。
 * どのページも、ふだんの「戻る」は決まった行き先へのリンクなので、ここでまとめて受けとめる。
 * ほかのページへ移ったら、しるしは消す（そこからの「戻る」はいつもどおり）。
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { backToLauncher, clearLaunch, readLaunch } from "@/lib/launcher-return";

export function LauncherReturnBridge() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const r = readLaunch();
    if (r && pathname !== r.path && pathname !== "/home") clearLaunch();
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const r = readLaunch();
      if (!r || window.location.pathname !== r.path) return;
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!a || a.closest(".app-bottom-nav")) return;
      const label = (a.getAttribute("aria-label") ?? a.textContent ?? "").trim();
      if (!/戻る$/.test(label)) return;
      e.preventDefault();
      e.stopPropagation();
      backToLauncher((href) => router.push(href));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}

/** 開いたページがアプリの画面から来たか（見出しに「戻る」を出すため） */
export function useLaunchedHere(): boolean {
  const pathname = usePathname();
  const [here, setHere] = useState(false);
  useEffect(() => {
    const r = readLaunch();
    setHere(Boolean(r && r.path === pathname));
  }, [pathname]);
  return here;
}
