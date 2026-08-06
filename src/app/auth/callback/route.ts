import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/navigation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * 確認メール / パスワード再設定メールのリンク先。
 * PKCE の code 形式と、token_hash 形式のどちらにも対応する。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  // `//example.com` のようなプロトコル相対URLを弾き、自サイト内へのみ戻す
  const safeNext = safeNextPath(searchParams.get("next"));

  if (!getSupabaseEnv()) {
    return NextResponse.redirect(`${origin}/setup`);
  }

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }

  return NextResponse.redirect(`${origin}/login?notice=confirm-failed`);
}
