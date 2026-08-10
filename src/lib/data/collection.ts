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
