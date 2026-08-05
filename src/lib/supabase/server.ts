import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

/** ログイン必須ページで使う。未ログインならログイン画面へ送る */
export async function requireUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: SessionUser;
}> {
  if (!getSupabaseEnv()) redirect("/setup");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, profile_image_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user: {
      id: user.id,
      email: user.email ?? null,
      displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "ゲスト",
      profileImageUrl: profile?.profile_image_url ?? null,
    },
  };
}
