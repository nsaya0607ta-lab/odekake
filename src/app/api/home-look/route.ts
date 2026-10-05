import { NextResponse } from "next/server";
import { HOME_LOOK_COOKIE, normalizeHomeLook, serializeHomeLook } from "@/lib/home-look";
import { canAccessShop } from "@/lib/shop-access";
import { requireUser } from "@/lib/supabase/server";

type Rpc = (fn: "set_home_look", args: { p_look: unknown }) => Promise<{ error: { code?: string; message: string } | null }>;

/**
 * ホームの着せかえ（カードの並び・出す出さない・透け感）を保存する。
 * DB に入れて、ほかの端末でも同じにする。DB の準備（0124）がまだのときは、この端末だけに覚える（synced: false）。
 */
export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();
  if (!canAccessShop(user.displayName)) {
    return NextResponse.json({ error: "ショップは準備中です。" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as unknown;
  const look = normalizeHomeLook(body);

  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
  const { error } = await rpc("set_home_look", { p_look: look });
  if (error) console.warn("Failed to save home look", { code: error.code, message: error.message });

  const response = NextResponse.json({ ok: true, look, synced: !error }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(HOME_LOOK_COOKIE, serializeHomeLook(look), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
