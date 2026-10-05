import { NextResponse } from "next/server";
import { APP_BACKGROUND_COOKIE } from "@/lib/app-backgrounds";
import { getHomeAppearance } from "@/lib/data/app-backgrounds";
import { requireUser } from "@/lib/supabase/server";

/**
 * この端末の背景（Cookie）を、DB に保存してある背景にそろえる。
 * 別の端末で背景を変えたあと、ホームを開いたときに呼ばれる。
 */
export async function POST() {
  const { supabase, user } = await requireUser();
  const { savedBackground } = await getHomeAppearance(supabase, user.id);
  if (!savedBackground) return NextResponse.json({ ok: false }, { status: 404 });
  const response = NextResponse.json({ ok: true, background: savedBackground }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(APP_BACKGROUND_COOKIE, savedBackground, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
