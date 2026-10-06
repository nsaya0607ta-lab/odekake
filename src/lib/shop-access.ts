/**
 * ショップ（青コインで背景を買う）を使えるか。2026-10 から全員に公開している。
 * ナビ・画面・APIで同じ判定を使うので、また一部の人だけにしたいときはここを変える。
 */
export function canAccessShop(_displayName?: string | null): boolean {
  return true;
}
