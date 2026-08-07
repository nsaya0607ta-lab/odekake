"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const MAIN_ROUTES = ["/home", "/map", "/add", "/records", "/mypage", "/workspaces"];

/**
 * スマホで下部ナビを押してから待たされないよう、主要画面だけ先に読み込む。
 *
 * 以前は画面上のリンクに指が触れるたびに prefetch していたが、この
 * アプリの画面はほぼすべて `force-dynamic` なので、prefetch のたびに
 * サーバー側で本番と同じDBの問い合わせ一式が走ってしまう。市区町村の
 * 一覧をスクロールするだけで大量の無駄な描画が起きるため、温めるのは
 * 数の決まっている主要画面に限る。
 */
export function RoutePreloader() {
  const router = useRouter();
  const pathname = usePathname();
  const prefetched = useRef(new Set<string>());

  useEffect(() => {
    // 初期表示を妨げないよう少し待ってから、下部ナビの行き先を温める。
    const timer = window.setTimeout(() => {
      for (const href of MAIN_ROUTES) {
        if (href === pathname || prefetched.current.has(href)) continue;
        prefetched.current.add(href);
        router.prefetch(href);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  return null;
}
