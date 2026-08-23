"use server";

import { revalidatePath } from "next/cache";
import { markNoticesRead } from "@/lib/data/notices";
import { requireUser } from "@/lib/supabase/server";

/**
 * お知らせを既読にする。
 *
 * 詳細ページのServer Component描画中に直接 markNoticesRead を呼ぶだけでは
 * DB上は既読になっても、Next.jsのルーターキャッシュに残った一覧ページの
 * 古い描画結果（未読表示）が更新されず、一覧へ戻ると未読のままに見える。
 * Server Actionとして呼び出し revalidatePath することで、一覧・ホームの
 * キャッシュも合わせて更新する。
 */
export async function markNoticeReadAction(noticeId: string): Promise<void> {
  const { supabase } = await requireUser();
  await markNoticesRead(supabase, [noticeId]);
  revalidatePath("/notices");
  revalidatePath("/home");
}
