import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getSupabaseEnv, requireSupabaseEnv } from "./env";
import type { Database } from "./types";

export async function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component からは Cookie を書けない。middleware 側で更新されるため無視してよい
        }
      },
    },
  });
}

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string;
  profileImageUrl: string | null;
};

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * ログイン必須ページで使う。未ログインならログイン画面へ送る。
 *
 * getUser() は画面遷移のたびに Auth サーバーへ通信するため、ページ保護には
 * JWT を検証する getClaims() を使う。ニックネームはサインアップ時に入れた
 * user_metadata から読むことで、全画面で発生していた profiles の追加取得も省く。
 */
export const requireUser = cache(async function requireUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: SessionUser;
}> {
  if (!getSupabaseEnv()) redirect("/setup");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = recordOf(data?.claims);
  const userId = typeof claims.sub === "string" ? claims.sub : null;

  if (error || !userId) redirect("/login");

  const email = typeof claims.email === "string" ? claims.email : null;
  const metadata = recordOf(claims.user_metadata);
  const displayName =
    typeof metadata.display_name === "string" && metadata.display_name.trim()
      ? metadata.display_name.trim()
      : email?.split("@")[0] ?? "ゲスト";
  const profileImageUrl =
    typeof metadata.profile_image_url === "string" && metadata.profile_image_url
      ? metadata.profile_image_url
      : null;

  return {
    supabase,
    user: {
      id: userId,
      email,
      displayName,
      profileImageUrl,
    },
  };
});
