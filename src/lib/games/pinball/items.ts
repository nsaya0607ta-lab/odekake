/**
 * ご当地ピンボールの台に出すご当地アイテム
 * =============================================================
 * 都道府県図鑑のアイテムのうち、犬のすがた（〇〇のフレブル）はのぞく（台にフレブルは出さない）。
 * 台えらびとルールのページで使うので、地図のデータは読まない軽いファイルにしてある。
 */
import { PREF_ITEMS, type CollectionItem } from "@/lib/collection/items";
import { getPrize } from "@/lib/gacha/prizes";

function isPinballItem(item: CollectionItem): boolean {
  return getPrize(item.id)?.type !== "dog_skin" && Boolean(item.image);
}

/** 台に出るご当地アイテム（全部の県。犬のすがたはのぞく） */
export function pinballItems(): CollectionItem[] {
  return PREF_ITEMS.filter(isPinballItem);
}

/** その県の、台に出るご当地アイテム（ルールのスキル一覧で県ごとに分けて出す） */
export function pinballPrefItems(prefCode: string): CollectionItem[] {
  return PREF_ITEMS.filter((item) => item.pref === prefCode && isPinballItem(item));
}

/** ご当地アイテムがある都道府県（北から順） */
export function pinballPrefCodes(): string[] {
  return [...new Set(PREF_ITEMS.map((item) => item.pref!))].sort();
}
