import { PHOTO_BUCKET, type DB } from "./client";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** ストレージのパス群を署名付き URL に変換する。失敗したものは除外する */
export async function signPhotoPaths(supabase: DB, paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return result;

  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return result;

  for (const item of data) {
    if (item.signedUrl && item.path) result.set(item.path, item.signedUrl);
  }
  return result;
}

export async function signPhotoPath(supabase: DB, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const map = await signPhotoPaths(supabase, [path]);
  return map.get(path) ?? null;
}
