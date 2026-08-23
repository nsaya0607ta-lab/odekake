"use client";

import { useEffect } from "react";
import { markNoticeReadAction } from "@/app/(app)/notices/actions";

/**
 * Server Componentのレンダリング中に revalidatePath を呼ぶとNext.jsが
 * エラーを投げるため、マウント時にクライアントからServer Actionを呼び出す。
 */
export function MarkNoticeRead({ noticeId }: { noticeId: string }) {
  useEffect(() => {
    markNoticeReadAction(noticeId);
  }, [noticeId]);

  return null;
}
