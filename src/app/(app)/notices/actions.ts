"use server";

import { revalidatePath } from "next/cache";
import { markNoticesRead } from "@/lib/data/notices";
import { requireUser } from "@/lib/supabase/server";

/**
 * お知らせを既読にする。
 *
 * クライアント側（マウント時のuseEffect）から呼び出すこと。
 * revalidatePathはユーザー操作起点のServer Action呼び出し内でのみ実行でき、
 * Server Componentのレンダリング中に直接呼ぶとNext.jsがエラーを投げる。
 */
export async function markNoticeReadAction(noticeId: string): Promise<void> {
  const { supabase } = await requireUser();
  await markNoticesRead(supabase, [noticeId]);
  revalidatePath("/notices");
  revalidatePath("/home");
}
