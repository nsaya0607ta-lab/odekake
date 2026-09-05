import type { DB } from "./client";

/**
 * ダンボールの所持数（重複数=user_dambourle_items.count）。
 * ここからスキルLv・解放済みスキン段階を計算する（src/lib/dambourle/skill-levels.ts）。
 */
export async function getOwnedDambourleCounts(supabase: DB, userId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("user_dambourle_items")
    .select("item_id,count")
    .eq("user_id", userId);

  if (error) {
    console.warn("Dambourle counts are unavailable", { code: error.code, message: error.message });
    return new Map();
  }

  return new Map((data ?? []).map((row) => [row.item_id, Math.max(0, row.count)]));
}

export type DambourleEquipped = { itemId: string; skinIndex: number };

/** プレイ前に選んだ「装備中のダンボール＋スキン段階」。未選択なら初期無料ダンボール扱い。 */
export async function getEquippedDambourle(supabase: DB, userId: string): Promise<DambourleEquipped | null> {
  const { data, error } = await supabase
    .from("user_dambourle_equipped")
    .select("item_id,skin_index")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Equipped dambourle is unavailable", { code: error.code, message: error.message });
    return null;
  }
  if (!data) return null;

  return { itemId: data.item_id, skinIndex: data.skin_index };
}
