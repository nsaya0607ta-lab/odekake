"use server";

import { revalidatePath } from "next/cache";
import { markNoticesRead } from "@/lib/data/notices";
import { requireUser } from "@/lib/supabase/server";

/** お知らせをタップして内容を確認したタイミングでだけ既読にする。 */
export async function markNoticeReadAction(formData: FormData): Promise<void> {
  const noticeId = String(formData.get("noticeId") ?? "");
  if (!noticeId) return;

  const { supabase } = await requireUser();
  await markNoticesRead(supabase, [noticeId]);

  revalidatePath("/notices");
  revalidatePath("/home");
}
