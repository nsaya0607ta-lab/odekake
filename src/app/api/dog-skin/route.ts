import { NextResponse } from "next/server";
import { DOG_SKIN_COOKIE, getDogSkin, isDogSkinId } from "@/lib/dog-skins";
import { requireUser } from "@/lib/supabase/server";

/**
 * 犬スキンの切り替え。
 *
 * 選択状態はCookieへ保存するため、0017_dog_skins.sql がまだ本番DBへ
 * 適用されていなくても切り替えできる。ガチャ景品の所持判定は既存の
 * user_gacha_items でサーバー側から確認する。
 */
export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();

  const body = (await request.json().catch(() => null)) as { skinId?: unknown } | null;
  if (!body || !isDogSkinId(body.skinId)) {
    return NextResponse.json({ error: "スキンが正しくありません。" }, { status: 400 });
  }

  const skin = getDogSkin(body.skinId);

  if (skin.unlockItemId) {
    const { data, error } = await supabase
      .from("user_gacha_items")
      .select("item_id")
      .eq("user_id", user.id)
      .eq("item_id", skin.unlockItemId)
      .maybeSingle();

    if (error) {
      console.warn("Failed to check dog skin ownership", { code: error.code, message: error.message });
      return NextResponse.json({ error: "犬の所持情報を確認できませんでした。" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "この犬はまだガチャで手に入れていません。" }, { status: 403 });
    }
  }

  const response = NextResponse.json(
    { ok: true, skinId: body.skinId },
    { headers: { "Cache-Control": "no-store" } },
  );

  response.cookies.set(DOG_SKIN_COOKIE, body.skinId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
