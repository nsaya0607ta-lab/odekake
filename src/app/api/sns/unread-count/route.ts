import { NextResponse } from "next/server";
import { getSnsUnreadCount } from "@/lib/data/sns-notifications";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** 画面本体の描画後に、通知バッジだけを独立して取得する。 */
export async function GET() {
  const { supabase, user } = await requireUser();
  const unreadCount = await getSnsUnreadCount(supabase, user.id);
  return NextResponse.json(
    { unreadCount },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
