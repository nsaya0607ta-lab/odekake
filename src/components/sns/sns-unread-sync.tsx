"use client";

import { useEffect } from "react";
import { refreshSnsUnreadCount, setSnsUnreadCount } from "@/components/sns/use-sns-unread-count";

/** Server Actionで確定した未読数を、固定ナビを含む全バッジへ同期する。 */
export function SnsUnreadSync({ count }: { count: number }) {
  useEffect(() => {
    setSnsUnreadCount(count);
  }, [count]);

  return null;
}

/** 画面表示後にサーバー側で既読化するページ向けの遅延同期。 */
export function SnsUnreadRefresh({ delayMs = 800 }: { delayMs?: number }) {
  useEffect(() => {
    const timer = window.setTimeout(() => void refreshSnsUnreadCount(), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  return null;
}
