/**
 * 検索用の文字ゆれの吸収
 * =============================================================
 * 「カフェ」と「かふぇ」、全角と半角のように、同じつもりで打った文字が
 * 一致しないと探せない。比較する前に次をそろえる。
 *
 *   - 全角英数字・記号 → 半角（NFKC）
 *   - カタカナ → ひらがな
 *   - 英字 → 小文字
 *
 * 漢字を読みで引くこと（「とうきょう」で「東京都」）はできない。
 * 市区町村・スポットのどちらにも読みのデータを持っていないため、
 * 読みを足すならデータ側の用意が先になる。
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/\s+/g, "");
}

/** `needle` が `haystack` のいずれかに含まれるか。文字ゆれを吸収して比べる */
export function matchesSearch(needle: string, ...haystack: Array<string | null | undefined>): boolean {
  const target = normalizeForSearch(needle);
  if (!target) return true;
  return haystack.some((value) => value && normalizeForSearch(value).includes(target));
}
