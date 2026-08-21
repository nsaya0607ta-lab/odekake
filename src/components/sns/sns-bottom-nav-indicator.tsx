import { Suspense } from "react";
import { getSnsUnreadCount } from "@/lib/data/sns-notifications";
import { requireUser } from "@/lib/supabase/server";

/** 下部ナビを待たせず、未読があるときだけSNSカメラの右上へ光る丸を足す。 */
export function SnsBottomNavIndicator() {
  return (
    <Suspense fallback={null}>
      <UnreadDot />
    </Suspense>
  );
}

async function UnreadDot() {
  const { supabase, user } = await requireUser();
  const unreadCount = await getSnsUnreadCount(supabase, user.id);
  if (unreadCount === 0) return null;

  return <span className="sns-bottom-unread-dot" aria-hidden="true" />;
}
