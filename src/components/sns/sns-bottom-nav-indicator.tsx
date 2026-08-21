"use client";

import { useSnsUnreadCount } from "./use-sns-unread-count";

/** 初期表示後に未読数を取得し、SNSカメラの右上へ光る丸を足す。 */
export function SnsBottomNavIndicator() {
  const unreadCount = useSnsUnreadCount();
  if (unreadCount === 0) return null;

  return <span className="sns-bottom-unread-dot" aria-hidden="true" />;
}
