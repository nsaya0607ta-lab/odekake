export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

/** 環境変数が揃っているときだけ設定を返す。未設定でもビルドは通るようにする */
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function requireSupabaseEnv(): SupabaseEnv {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase の環境変数が設定されていません。NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。",
    );
  }
  return env;
}

/** メール確認リンクなどの戻り先 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
