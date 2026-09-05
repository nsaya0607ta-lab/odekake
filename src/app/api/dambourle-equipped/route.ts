import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isDambourleGachaEnabled } from "@/lib/dambourle/feature-flag";
import { getDambourlePrize } from "@/lib/dambourle/prizes";
import { requireUser } from "@/lib/supabase/server";

/**
 * プレイ前の「装備中のダンボール＋スキン段階」の切り替え。
 * 所持・解放済みスキン段階のチェックはRPC(set_dambourle_equipped, SECURITY DEFINER)側で行う。
 */
export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();
  if (!isDambourleGachaEnabled(user.email)) {
    return NextResponse.json({ error: "この機能はまだ利用できません。" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { itemId?: unknown; skinIndex?: unknown } | null;
  const isDefault = body?.itemId === "default";
  if (!body || typeof body.itemId !== "string" || (!isDefault && !getDambourlePrize(body.itemId))) {
    return NextResponse.json({ error: "ダンボールが正しくありません。" }, { status: 400 });
  }
  if (typeof body.skinIndex !== "number" || !Number.isInteger(body.skinIndex) || body.skinIndex < 0 || body.skinIndex > 5) {
    return NextResponse.json({ error: "スキンが正しくありません。" }, { status: 400 });
  }
  if (isDefault && body.skinIndex !== 0) {
    return NextResponse.json({ error: "初期のダンボールにはスキンを設定できません。" }, { status: 400 });
  }

  const { error } = await supabase.rpc("set_dambourle_equipped", {
    p_item_id: body.itemId,
    p_skin_index: body.skinIndex,
  });

  if (error) {
    if (error.message.includes("まだガチャで手に入れていません")) {
      return NextResponse.json({ error: "このダンボールはまだガチャで手に入れていません。" }, { status: 403 });
    }
    if (error.message.includes("まだ解放されていません")) {
      return NextResponse.json({ error: "このスキンはまだ解放されていません。" }, { status: 403 });
    }
    console.warn("Failed to set equipped dambourle", { code: error.code, message: error.message });
    return NextResponse.json({ error: "切り替えできませんでした。" }, { status: 500 });
  }

  revalidatePath("/games/item-catch");
  revalidatePath("/games/item-catch/dambourle");

  return NextResponse.json(
    { ok: true, itemId: body.itemId, skinIndex: body.skinIndex },
    { headers: { "Cache-Control": "no-store" } },
  );
}
