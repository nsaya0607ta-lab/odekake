import { NextResponse } from "next/server";
import { COLLECTION_ITEMS } from "@/lib/collection/items";
import type { RoomRotation } from "@/lib/data/room";
import {
  ROOM_POSITION_MAX,
  ROOM_POSITION_MIN,
  ROOM_SCALE_MAX,
  ROOM_SCALE_MIN,
} from "@/lib/room";
import { requireUser } from "@/lib/supabase/server";

const ITEM_IDS = new Set(COLLECTION_ITEMS.map((item) => item.id));
const ROTATIONS: readonly RoomRotation[] = [0, 90, 180, 270];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRoomRotation(value: unknown): value is RoomRotation {
  return isFiniteNumber(value) && (ROTATIONS as readonly number[]).includes(value);
}

export async function PATCH(request: Request) {
  const { supabase } = await requireUser();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body || typeof body.itemId !== "string" || !ITEM_IDS.has(body.itemId)) {
    return NextResponse.json({ error: "アイテムが正しくありません。" }, { status: 400 });
  }
  if (
    !isFiniteNumber(body.x) ||
    !isFiniteNumber(body.y) ||
    body.x < ROOM_POSITION_MIN ||
    body.x > ROOM_POSITION_MAX ||
    body.y < ROOM_POSITION_MIN ||
    body.y > ROOM_POSITION_MAX
  ) {
    return NextResponse.json({ error: "置き場所が正しくありません。" }, { status: 400 });
  }
  if (!isRoomRotation(body.rotation)) {
    return NextResponse.json({ error: "向きが正しくありません。" }, { status: 400 });
  }
  if (
    !isFiniteNumber(body.scale) ||
    body.scale < ROOM_SCALE_MIN ||
    body.scale > ROOM_SCALE_MAX
  ) {
    return NextResponse.json({ error: "大きさが正しくありません。" }, { status: 400 });
  }
  if (!Number.isInteger(body.zIndex) || (body.zIndex as number) < 0 || (body.zIndex as number) > 1000) {
    return NextResponse.json({ error: "重なり順が正しくありません。" }, { status: 400 });
  }

  const { error } = await supabase.rpc("set_room_item", {
    p_item_id: body.itemId,
    p_position_x: body.x,
    p_position_y: body.y,
    p_rotation: body.rotation,
    p_scale: body.scale,
    p_z_index: body.zIndex as number,
  });

  if (error) {
    console.error("Failed to save room item", { code: error.code, message: error.message });
    return NextResponse.json({ error: "配置を保存できませんでした。" }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const { supabase } = await requireUser();
  const body = (await request.json().catch(() => null)) as { itemId?: unknown } | null;

  if (!body || typeof body.itemId !== "string" || !ITEM_IDS.has(body.itemId)) {
    return NextResponse.json({ error: "アイテムが正しくありません。" }, { status: 400 });
  }

  const { error } = await supabase.rpc("clear_room_item", { p_item_id: body.itemId });
  if (error) {
    console.error("Failed to remove room item", { code: error.code, message: error.message });
    return NextResponse.json({ error: "配置を片づけられませんでした。" }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
