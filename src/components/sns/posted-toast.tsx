"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconCheck } from "@/components/icons";

/** 写真投稿後の ?posted=1 を、画面上部に一時的な通知として出す。
 * ページ内に居座らせず、数秒で消してURLからも消す */
export function PostedToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const posted = searchParams.get("posted") === "1";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!posted) return;
    setVisible(true);

    const hide = setTimeout(() => setVisible(false), 2200);
    const cleanup = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      params.delete("posted");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 2600);

    return () => {
      clearTimeout(hide);
      clearTimeout(cleanup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posted]);

  if (!posted) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <div
        role="status"
        className={`sns-posted-toast ${
          visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
        }`}
      >
        <span className="sns-posted-toast-check" aria-hidden="true"><IconCheck size={16} /></span>
        <span>
          <span className="block text-[10px] font-black tracking-[0.12em] text-white/70">MEMORY SAVED</span>
          <span className="block text-xs font-black">写真を投稿しました</span>
        </span>
        <span className="text-[#ffe16d]" aria-hidden="true">✦</span>
      </div>
    </div>
  );
}
