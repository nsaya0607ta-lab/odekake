import type { EquipmentSlot } from "@/lib/equipment";
import type { DB } from "./client";

/** スロットごとの装着中レベル。装着していないスロットはキーを持たない */
export type EquipmentMap = Partial<Record<EquipmentSlot, number>>;

export async function getEquipment(supabase: DB, userId: string): Promise<EquipmentMap> {
  const { data, error } = await supabase.from("user_equipment").select("slot, level").eq("user_id", userId);

  if (error) {
    console.warn("Equipment is unavailable", { code: error.code, message: error.message });
    return {};
  }

  const map: EquipmentMap = {};
  for (const row of data ?? []) map[row.slot] = row.level;
  return map;
}
