import type { DB } from "./client";

/**
 * 図鑑の所持判定。
 * ガチャで手に入れたもの（user_gacha_items）をそのまま使うので、
 * 景品が増えても取得のしかたが増えても、ここは変えなくてよい。
 */
export async function getOwnedItemIds(supabase: DB, userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("user_gacha_items").select("item_id").eq("user_id", userId);

  if (error) {
    console.warn("Collection is unavailable", { code: error.code, message: error.message });
    return new Set();
  }

  return new Set((data ?? []).map((row) => row.item_id));
}

/**
 * 図鑑カードに表示する「出た回数」。
 * user_gacha_items.count は初回を1として、同じ景品が出るたびに増える。
 */
export async function getOwnedItemCounts(supabase: DB, userId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("user_gacha_items")
    .select("item_id,count")
    .eq("user_id", userId);

  if (error) {
    console.warn("Collection counts are unavailable", { code: error.code, message: error.message });
    return new Map();
  }

  return new Map((data ?? []).map((row) => [row.item_id, Math.max(0, row.count)]));
}
