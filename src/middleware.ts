import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** 未ログインでも開ける画面・リソース */
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/signup/complete",
  "/forgot-password",
  "/reset-password",
  "/setup",
  "/auth",
  "/privacy",
  "/terms",
  "/manifest.webmanifest",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const env = getSupabaseEnv();
  const { pathname } = request.nextUrl;

  if (!env) {
    if (
      pathname === "/setup" ||
      pathname === "/manifest.webmanifest" ||
      pathname === "/privacy" ||
      pathname === "/terms"
    ) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/setup";
    return NextResponse.redirect(url);
  }

  // iPhoneショートカットはSupabaseのログインCookieを持たない。
  // /api/steps/sync はroute側でBearer連携キーを検証するため、
  // ここでは認証処理もログイン画面へのリダイレクトも行わない。
  if (pathname === "/api/steps/sync") {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() は遷移のたびに Auth サーバーへ通信する。
  // ページ保護には署名と期限を検証する getClaims() を使い、往復通信を減らす。
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // 元の画面のクエリを /login にそのまま残さない（?tab=... などが紛れ込むため）
    url.search = "";
    // ログイン後に元の画面へ戻す
    if (pathname !== "/") url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
