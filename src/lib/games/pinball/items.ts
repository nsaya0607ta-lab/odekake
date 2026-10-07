/**
 * ご当地ピンボールの台に出すご当地アイテム
 * =============================================================
 * 都道府県図鑑のアイテムのうち、犬のすがた（〇〇のフレブル）はのぞく（台にフレブルは出さない）。
 * サーバーの記録（どの台で遊べるか）と台えらびの両方で使うので、地図のデータは読まない軽いファイルにしてある。
 */
import { PREF_ITEMS, type CollectionItem } from "@/lib/collection/items";
import { getPrize } from "@/lib/gacha/prizes";
import { DEFAULT_TABLE_ID } from "./themes";

export function pinballPrefItems(prefCode: string): CollectionItem[] {
  return PREF_ITEMS.filter((item) => item.pref === prefCode && getPrize(item.id)?.type !== "dog_skin" && Boolean(item.image));
}

/** 台に出せる都道府県（ご当地アイテムがある県・北から順） */
export function pinballPrefCodes(): string[] {
  return [...new Set(PREF_ITEMS.map((item) => item.pref!))].sort();
}

/** その台で遊べるか（いつもの台はだれでも、県の台はその県のアイテムを1つでも持っていれば） */
export function isPinballTableUnlocked(tableId: string, owned: ReadonlyMap<string, number>): boolean {
  if (tableId === DEFAULT_TABLE_ID) return true;
  if (!pinballPrefCodes().includes(tableId)) return false;
  return pinballPrefItems(tableId).some((item) => (owned.get(item.id) ?? 0) > 0);
}
