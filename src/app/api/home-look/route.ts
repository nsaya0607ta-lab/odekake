import { NextResponse } from "next/server";
import { HOME_LOOK_COOKIE, normalizeHomeLook, serializeHomeLook } from "@/lib/home-look";
import { canAccessShop } from "@/lib/shop-access";
import { requireUser } from "@/lib/supabase/server";

/** ホームの着せかえ（カードの並び・出す出さない・透け感）を、この端末に保存する */
export async function PATCH(request: Request) {
  const { user } = await requireUser();
  if (!canAccessShop(user.displayName)) {
    return NextResponse.json({ error: "ショップは準備中です。" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as unknown;
  const look = normalizeHomeLook(body);
  const response = NextResponse.json({ ok: true, look }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(HOME_LOOK_COOKIE, serializeHomeLook(look), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
