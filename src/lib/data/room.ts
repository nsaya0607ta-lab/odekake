import type { DB } from "./client";

export type RoomRotation = 0 | 90 | 180 | 270;

export type RoomPlacement = {
  itemId: string;
  x: number;
  y: number;
  rotation: RoomRotation;
  scale: number;
  zIndex: number;
};

export async function getRoomItems(supabase: DB, userId: string): Promise<RoomPlacement[]> {
  const { data, error } = await supabase
    .from("room_items")
    .select("item_id,position_x,position_y,rotation,scale_value,z_index")
    .eq("user_id", userId)
    .order("z_index", { ascending: true });

  if (error) {
    // マイグレーション適用前でも、マイルーム以外の画面へ影響させない。
    console.warn("Room layout is unavailable", { code: error.code, message: error.message });
    return [];
  }

  return (data ?? []).map((row) => ({
    itemId: row.item_id,
    x: row.position_x,
    y: row.position_y,
    rotation: row.rotation,
    scale: row.scale_value,
    zIndex: row.z_index,
  }));
}
