import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DOG_SKIN_COOKIE, isDogSkinId } from "@/lib/dog-skins";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** 未ログインでも開ける画面・リソース */
const PUBLIC_PATHS = [
  "/sns-guide.html",
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
  "/gacha-preview",
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
      pathname === "/gacha-preview" ||
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
  // これらのAPIはroute側でBearer連携キーを検証するため、
  // ここでは認証処理もログイン画面へのリダイレクトも行わない。
  if (pathname === "/api/steps/sync" || pathname === "/api/visits/shortcut") {
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

  // 犬スキンのCookieが無い（切り替えたことがない）利用者は、(app)/layout.tsx の
  // getCurrentDogSkin が画面遷移のたびにDBへ問い合わせてしまう。ここで一度だけ
  // 結果をCookieへ焼いておけば、以降の遷移はCookie読み取りだけで済む。
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (isAuthenticated && userId && !isDogSkinId(request.cookies.get(DOG_SKIN_COOKIE)?.value)) {
    const { data: skinRow } = await supabase
      .from("user_dog_skin")
      .select("skin_id")
      .eq("user_id", userId)
      .maybeSingle();
    const skinId = isDogSkinId(skinRow?.skin_id) ? skinRow.skin_id : "default";
    response.cookies.set(DOG_SKIN_COOKIE, skinId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
