import { PHOTO_BUCKET, type DB } from "@/lib/data/client";

/**
 * 写真の保存先
 * =============================================================
 * 保存ボタンを押す前の写真は、いったん一時領域へ置く。
 *
 *   tmp/{user_id}/{draft_token}/...        ← アップロード直後（未保存）
 *   trips/{trip_id}/cover/...              ← 保存時に移動
 *   trips/{trip_id}/visits/{visit_id}/...
 *   users/{user_id}/profile/...
 *
 * こうしておくと、フォームを保存せずに離れた写真は tmp/ に残るだけで、
 * 本来の場所を汚さない。残ったファイルは cleanupTemporaryPhotosAction()
 * が期限切れとして削除する。
 */
export const TMP_ROOT = "tmp";

/** 一時領域に置いたまま消してよくなるまでの時間 */
export const TMP_RETENTION_HOURS = 12;

export function tmpPrefixFor(userId: string, draftToken: string): string {
  return `${TMP_ROOT}/${userId}/${draftToken}`;
}

export function isTemporaryPath(path: string): boolean {
  return path.startsWith(`${TMP_ROOT}/`);
}

function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * 一時領域の写真を本来の場所へ移す。
 * すでに本来の場所にあるものはそのまま返す。移動に失敗したものは取り除く
 * （参照できないパスを記録に残さないため）。
 */
export async function finalizePhotoPaths(
  supabase: DB,
  paths: string[],
  destinationPrefix: string,
): Promise<string[]> {
  const result: string[] = [];

  for (const path of paths) {
    if (!isTemporaryPath(path)) {
      result.push(path);
      continue;
    }

    const destination = `${destinationPrefix}/${basenameOf(path)}`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).move(path, destination);

    if (!error) {
      result.push(destination);
      continue;
    }

    // すでに移動済みなら、移動先にファイルがあるはず
    const { data } = await supabase.storage.from(PHOTO_BUCKET).list(destinationPrefix, {
      search: basenameOf(path),
      limit: 1,
    });
    if ((data ?? []).some((item) => item.name === basenameOf(path))) result.push(destination);
  }

  return result;
}

/** 指定したフォルダ以下のファイルをすべて消す（アカウント削除時の後片付け用） */
export async function removeFolderRecursively(supabase: DB, prefix: string, depth = 3): Promise<number> {
  if (depth <= 0) return 0;

  const { data: entries } = await supabase.storage.from(PHOTO_BUCKET).list(prefix, { limit: 1000 });
  if (!entries || entries.length === 0) return 0;

  const files = entries.filter((entry) => entry.id).map((entry) => `${prefix}/${entry.name}`);
  const folders = entries.filter((entry) => !entry.id);

  let removed = 0;
  if (files.length > 0) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(files);
    if (!error) removed += files.length;
  }
  for (const folder of folders) {
    removed += await removeFolderRecursively(supabase, `${prefix}/${folder.name}`, depth - 1);
  }
  return removed;
}
