/**
 * ショップは準備中。ユーザー名「しゅん」だけが先に使える（ナビ・画面・APIで同じ判定を使う）。
 * 全員に公開するときは true を返すようにする。
 */
const SHOP_PREVIEW_USERS = new Set(["しゅん"]);

export function canAccessShop(displayName: string | null | undefined): boolean {
  return SHOP_PREVIEW_USERS.has(displayName?.trim() ?? "");
}
