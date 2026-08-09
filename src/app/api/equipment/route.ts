import { NextResponse } from "next/server";
import { ACCESSORY_SLOTS, type EquipmentSlot } from "@/lib/equipment";
import { requireUser } from "@/lib/supabase/server";

const VALID_SLOTS: readonly EquipmentSlot[] = [...ACCESSORY_SLOTS, "title"];

function isEquipmentSlot(value: unknown): value is EquipmentSlot {
  return typeof value === "string" && (VALID_SLOTS as readonly string[]).includes(value);
}

export async function PATCH(request: Request) {
  const { supabase } = await requireUser();

  const body = (await request.json().catch(() => null)) as { slot?: unknown; level?: unknown } | null;
  if (!body || !isEquipmentSlot(body.slot)) {
    return NextResponse.json({ error: "スロットが正しくありません。" }, { status: 400 });
  }
  if (body.level !== null && typeof body.level !== "number") {
    return NextResponse.json({ error: "レベルが正しくありません。" }, { status: 400 });
  }

  const { error } = await supabase.rpc("set_equipped_item", {
    p_slot: body.slot,
    p_level: body.level,
  });

  if (error) {
    console.error("Failed to update equipment", { code: error.code, message: error.message });
    return NextResponse.json({ error: "そうびを変更できませんでした。" }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
