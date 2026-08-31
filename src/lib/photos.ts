import { PHOTO_BUCKET, type DB } from "@/lib/data/client";
import { toThumbPath } from "@/lib/image";

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
 *
 * tmp/ を許可する Storage ポリシーが未適用のデータベースでは tmp/ へ書けないため、
 * 予備の一時領域として users/{user_id}/uploads/{draft_token}/ も使う。
 * users/{user_id}/ は最初のマイグレーションから自分専用の領域として許可されており、
 * ポリシーの適用状況にかかわらず書き込める。
 */
export const TMP_ROOT = "tmp";

/** users/{user_id}/ 配下に置く予備の一時領域 */
export const USER_TMP_SEGMENT = "uploads";

const USER_TMP_PATTERN = new RegExp(`^users/[^/]+/${USER_TMP_SEGMENT}/`);

/** 一時領域に置いたまま消してよくなるまでの時間 */
export const TMP_RETENTION_HOURS = 12;

export function tmpPrefixFor(userId: string, draftToken: string): string {
  return `${TMP_ROOT}/${userId}/${draftToken}`;
}

/** tmp/ へ書けなかったときに使う、自分専用フォルダ内の一時領域 */
export function userTmpPrefixFor(userId: string, draftToken: string): string {
  return `users/${userId}/${USER_TMP_SEGMENT}/${draftToken}`;
}

/** 片づけ対象になる一時領域の根っこ（自分の分だけ） */
export function tmpRootsFor(userId: string): string[] {
  return [`${TMP_ROOT}/${userId}`, `users/${userId}/${USER_TMP_SEGMENT}`];
}

export function isTemporaryPath(path: string): boolean {
  return path.startsWith(`${TMP_ROOT}/`) || USER_TMP_PATTERN.test(path);
}

function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * 一時領域の写真を本来の場所へ移す。
 * すでに本来の場所にあるものはそのまま返す。移動に失敗したものは取り除く
 * （参照できないパスを記録に残さないため）。
 *
 * bucket を省略すると既定の photos バケットを使う。サムネイルの移動も
 * photos バケット内の写真を前提にしているため、他バケットでは行わない。
 */
export async function finalizePhotoPaths(
  supabase: DB,
  paths: string[],
  destinationPrefix: string,
  bucket: string = PHOTO_BUCKET,
): Promise<string[]> {
  const result: string[] = [];

  for (const path of paths) {
    if (!isTemporaryPath(path)) {
      result.push(path);
      continue;
    }

    const destination = `${destinationPrefix}/${basenameOf(path)}`;
    const { error } = await supabase.storage.from(bucket).move(path, destination);

    if (!error) {
      result.push(destination);
      // サムネイルも一緒に移す。無ければ失敗するだけなので結果は見ない
      if (bucket === PHOTO_BUCKET) {
        void supabase.storage.from(bucket).move(toThumbPath(path), toThumbPath(destination));
      }
      continue;
    }

    // すでに移動済みなら、移動先にファイルがあるはず
    const { data } = await supabase.storage.from(bucket).list(destinationPrefix, {
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
