import { PHOTO_BUCKET, type DB } from "./client";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
/** 実際の有効期限より早めに作り直し、期限切れギリギリのURLを配らないようにする猶予 */
const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;

type CachedSignedUrl = { signedUrl: string; expiresAt: number };

/**
 * サーバープロセス内で使い回す署名URLキャッシュ。
 * 同じストレージパスへの署名URLを短時間に何度も発行し直さないようにするためのもので、
 * 永続化はしない（プロセスが再起動すれば消える簡易キャッシュ）。
 */
const signedUrlCache = new Map<string, CachedSignedUrl>();

/** ストレージのパス群を署名付き URL に変換する。失敗したものは除外する */
export async function signPhotoPaths(supabase: DB, paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return result;

  const now = Date.now();
  const toFetch: string[] = [];
  for (const path of unique) {
    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt > now) {
      result.set(path, cached.signedUrl);
    } else {
      toFetch.push(path);
    }
  }
  if (toFetch.length === 0) return result;

  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(toFetch, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return result;

  const expiresAt = now + SIGNED_URL_TTL_SECONDS * 1000 - SIGNED_URL_REFRESH_MARGIN_MS;
  for (const item of data) {
    if (item.signedUrl && item.path) {
      result.set(item.path, item.signedUrl);
      signedUrlCache.set(item.path, { signedUrl: item.signedUrl, expiresAt });
    }
  }
  return result;
}

export async function signPhotoPath(supabase: DB, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const map = await signPhotoPaths(supabase, [path]);
  return map.get(path) ?? null;
}
