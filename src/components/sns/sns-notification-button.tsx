"use client";

import Link from "next/link";
import { IconBell } from "@/components/icons";
import { useSnsUnreadCount } from "./use-sns-unread-count";

/** 通知取得を初期描画から切り離し、ヘッダーを先に操作可能にする。 */
export function SnsNotificationEntry() {
  const unreadCount = useSnsUnreadCount();
  return <SnsNotificationButton unreadCount={unreadCount} />;
}

export function SnsNotificationButton({ unreadCount }: { unreadCount: number }) {
  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Link
      href="/sns/notifications"
      prefetch={false}
      aria-label={unreadCount > 0 ? `通知、未読${unreadCount}件` : "通知"}
      className="sns-notification-button pressable relative flex h-11 w-11 items-center justify-center rounded-full"
    >
      <IconBell size={21} />
      {unreadCount > 0 ? (
        <span className="sns-notification-badge absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-black text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
