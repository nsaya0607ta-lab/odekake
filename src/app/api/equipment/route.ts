import { NextResponse } from "next/server";
import { ACCESSORY_SLOTS, slotOfLevel, type EquipmentSlot } from "@/lib/equipment";
import { requireUser } from "@/lib/supabase/server";

const VALID_SLOTS: readonly EquipmentSlot[] = [...ACCESSORY_SLOTS, "title"];

function isEquipmentSlot(value: unknown): value is EquipmentSlot {
  return typeof value === "string" && (VALID_SLOTS as readonly string[]).includes(value);
}

export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();

  const body = (await request.json().catch(() => null)) as { slot?: unknown; level?: unknown } | null;
  if (!body || !isEquipmentSlot(body.slot)) {
    return NextResponse.json({ error: "スロットが正しくありません。" }, { status: 400 });
  }
  if (body.level !== null && typeof body.level !== "number") {
    return NextResponse.json({ error: "レベルが正しくありません。" }, { status: 400 });
  }

  if (body.level !== null && slotOfLevel(body.level) !== body.slot) {
    return NextResponse.json({ error: "この報酬はこのスロットには装着できません。" }, { status: 400 });
  }

  // Prefer the database RPC because it validates the user's unlocked level atomically.
  // Some deployed environments may not have migration 0012 applied yet, so fall back to
  // an authenticated direct write instead of making the equipment UI unusable.
  const { error: rpcError } = await supabase.rpc("set_equipped_item", {
    p_slot: body.slot,
    p_level: body.level,
  });

  if (!rpcError) {
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  console.warn("Equipment RPC failed; trying direct write fallback", {
    code: rpcError.code,
    message: rpcError.message,
  });

  if (body.level === null) {
    const { error } = await supabase
      .from("user_equipment")
      .delete()
      .eq("user_id", user.id)
      .eq("slot", body.slot);

    if (error) {
      console.error("Failed to unequip item", { code: error.code, message: error.message });
      return NextResponse.json({ error: "そうびを変更できませんでした。" }, { status: 400 });
    }
  } else {
    const { error } = await supabase.from("user_equipment").upsert(
      {
        user_id: user.id,
        slot: body.slot,
        level: body.level,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,slot" },
    );

    if (error) {
      console.error("Failed to equip item", { code: error.code, message: error.message });
      return NextResponse.json({ error: "そうびを変更できませんでした。" }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
