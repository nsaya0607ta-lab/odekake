import { LEVEL_REWARDS, type LevelReward } from "@/lib/exp";
import type { EquipmentSlot } from "@/lib/supabase/types";

export type { EquipmentSlot };

/**
 * レベルアップ報酬のうち装着できるもの（アクセサリー・称号）が、どのスロットに属すか。
 * 数値は supabase/migrations/0012_user_equipment.sql の equipment_slot_of() と必ず同じにする。
 *
 * Lv.2〜30 はすべて犬のモーション／表情の報酬になったので、いま装着できるものは無い。
 * ここを空にしないと、モーションの報酬がその番号のアクセサリーとして装着できてしまう。
 * 装備の仕組み（スロット・API・DB）はそのまま残してあるので、装着できる報酬を
 * 足すときはここに戻す。
 */
const SLOT_BY_LEVEL: Partial<Record<number, EquipmentSlot>> = {};

export const ACCESSORY_SLOTS: readonly EquipmentSlot[] = ["collar", "bandana", "hat", "backpack", "crown"];

export const SLOT_LABELS: Record<EquipmentSlot, string> = {
  collar: "首輪",
  bandana: "バンダナ",
  hat: "帽子",
  backpack: "リュック",
  crown: "クラウン",
  title: "称号",
};

export function slotOfLevel(level: number): EquipmentSlot | null {
  return SLOT_BY_LEVEL[level] ?? null;
}

/** そのスロットに属する報酬を、レベルの昇順で返す */
export function getSlotRewards(slot: EquipmentSlot): LevelReward[] {
  return LEVEL_REWARDS.filter((reward) => SLOT_BY_LEVEL[reward.level] === slot);
}
