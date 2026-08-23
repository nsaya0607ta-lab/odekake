import type { DB } from "./client";

/**
 * ストレージパスを、/api/photo プロキシ経由の配信URLに変換する。
 *
 * 以前は Supabase の署名付きURLをここで直接発行していたが、署名URLは
 * クエリの token/expires が毎回変わるためブラウザキャッシュが効かず、
 * Storage の egress（配信量）を無駄に消費していた。
 * ここではパスから決まる安定した URL だけを返し、実際の署名・配信は
 * リクエストの都度 /api/photo/[...path] ルートが行う（認可チェックもそちら）。
 */
function photoProxyUrl(path: string, opts?: { thumb?: boolean }): string {
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return opts?.thumb ? `/api/photo/${encodedPath}?thumb=1` : `/api/photo/${encodedPath}`;
}

export async function signPhotoPaths(_supabase: DB, paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const path of new Set(paths.filter(Boolean))) {
    result.set(path, photoProxyUrl(path));
  }
  return result;
}

export async function signPhotoPath(_supabase: DB, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  return photoProxyUrl(path);
}

/**
 * 一覧・アイコンなど小さい表示専用。サムネイル版があればそちらを、
 * 無ければ（古い投稿など）原寸にフォールバックする配信URLを返す。
 * サムネイルが実際に存在するかどうかの判定はリクエスト時に /api/photo 側で行う
 */
export async function signThumbOrOriginalPaths(_supabase: DB, paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const path of new Set(paths.filter(Boolean))) {
    result.set(path, photoProxyUrl(path, { thumb: true }));
  }
  return result;
}
