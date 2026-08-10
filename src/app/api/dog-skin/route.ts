import { NextResponse } from "next/server";
import { isDogSkinId } from "@/lib/dog-skins";
import { requireUser } from "@/lib/supabase/server";

/**
 * 犬スキンの切り替え。
 *
 * 所持しているかどうかの判定は set_dog_skin() の中でだけ行う。ここで先に
 * 判定してしまうと、DB 側のチェックと二重管理になってどちらかがズレる。
 * user_dog_skin への書き込み権限は authenticated に与えていないため、
 * この RPC を介さずにスキンを変えることはできない。
 */
export async function PATCH(request: Request) {
  const { supabase } = await requireUser();

  const body = (await request.json().catch(() => null)) as { skinId?: unknown } | null;
  if (!body || !isDogSkinId(body.skinId)) {
    return NextResponse.json({ error: "スキンが正しくありません。" }, { status: 400 });
  }

  const { error } = await supabase.rpc("set_dog_skin", { p_skin_id: body.skinId });

  if (error) {
    console.warn("Failed to set dog skin", { code: error.code, message: error.message });
    return NextResponse.json({ error: "この犬にはまだ変更できません。" }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
