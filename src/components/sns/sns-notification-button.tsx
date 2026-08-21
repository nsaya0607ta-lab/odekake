import Link from "next/link";
import { Suspense } from "react";
import { IconBell } from "@/components/icons";
import { getSnsUnreadCount } from "@/lib/data/sns-notifications";
import { requireUser } from "@/lib/supabase/server";

/** 通知取得を待たずにヘッダーを表示し、未読数だけ後からストリーミングする。 */
export function SnsNotificationEntry() {
  return (
    <Suspense fallback={<SnsNotificationButton unreadCount={0} />}>
      <SnsNotificationIndicator />
    </Suspense>
  );
}

async function SnsNotificationIndicator() {
  const { supabase, user } = await requireUser();
  const unreadCount = await getSnsUnreadCount(supabase, user.id);
  return <SnsNotificationButton unreadCount={unreadCount} />;
}

export function SnsNotificationButton({ unreadCount }: { unreadCount: number }) {
  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Link
      href="/sns/notifications"
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
