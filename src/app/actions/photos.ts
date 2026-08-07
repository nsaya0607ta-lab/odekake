"use server";

import { PHOTO_BUCKET } from "@/lib/data/client";
import { TMP_RETENTION_HOURS, tmpRootsFor } from "@/lib/photos";
import { requireUser } from "@/lib/supabase/server";

/**
 * 一時領域に残った写真を片づける。
 *
 * 写真は保存ボタンを押す前にアップロードするため、フォームを保存せずに
 * 画面を離れるとファイルだけが残る。自分の一時領域（tmp/ と
 * users/{user_id}/uploads/）を見て、一定時間を過ぎたものを削除する。
 * アプリを開いたときに1日1回だけ実行する。
 */
export async function cleanupTemporaryPhotosAction(): Promise<{ removed: number }> {
  const { supabase, user } = await requireUser();
  const cutoff = Date.now() - TMP_RETENTION_HOURS * 60 * 60 * 1000;

  const isExpired = (createdAt: string | null | undefined) => {
    if (!createdAt) return true;
    const time = Date.parse(createdAt);
    return Number.isNaN(time) || time < cutoff;
  };

  const expired: string[] = [];

  for (const root of tmpRootsFor(user.id)) {
    const { data: entries, error } = await supabase.storage.from(PHOTO_BUCKET).list(root, { limit: 200 });
    if (error || !entries) continue;

    for (const entry of entries) {
      if (entry.id) {
        if (isExpired(entry.created_at)) expired.push(`${root}/${entry.name}`);
        continue;
      }
      // 下書きごとのフォルダ
      const { data: files } = await supabase.storage
        .from(PHOTO_BUCKET)
        .list(`${root}/${entry.name}`, { limit: 200 });
      for (const file of files ?? []) {
        if (!file.id) continue;
        if (isExpired(file.created_at)) expired.push(`${root}/${entry.name}/${file.name}`);
      }
    }
  }

  if (expired.length === 0) return { removed: 0 };

  const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove(expired);
  return { removed: removeError ? 0 : expired.length };
}
