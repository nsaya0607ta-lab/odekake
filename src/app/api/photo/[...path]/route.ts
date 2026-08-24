import { type NextRequest, NextResponse } from "next/server";
import { PHOTO_BUCKET, type DB } from "@/lib/data/client";
import { toThumbPath } from "@/lib/image";
import { requireUser } from "@/lib/supabase/server";

// サーバー内で署名URLを発行した直後に自分で fetch するだけなので、有効期限は短くてよい
const SIGNED_URL_TTL_SECONDS = 60;

// パス自体が安定している（内容が変わらない）ため、ブラウザにこの応答を長期キャッシュさせて
// Storage の egress を削減する。private を付け、Vercel 等の共有CDNキャッシュには乗せない
// （アクセス権限は毎回このルートで再チェックしているため、共有キャッシュに乗せると
// その場でのチェックを迂回されてしまう）
const PROXY_CACHE_CONTROL = "private, max-age=2592000, immutable";

async function fetchStoragePhoto(supabase: DB, path: string): Promise<Response | null> {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  const response = await fetch(data.signedUrl);
  return response.ok ? response : null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { supabase } = await requireUser();

  const { path: segments } = await params;
  const path = segments.join("/");
  if (!path) return new NextResponse(null, { status: 404 });

  const wantThumb = request.nextUrl.searchParams.get("thumb") === "1";
  const response =
    (wantThumb ? await fetchStoragePhoto(supabase, toThumbPath(path)) : null) ??
    (await fetchStoragePhoto(supabase, path));

  if (!response?.body) return new NextResponse(null, { status: 404 });

  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("cache-control", PROXY_CACHE_CONTROL);

  return new NextResponse(response.body, { headers });
}
