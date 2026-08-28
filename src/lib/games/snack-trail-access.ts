/**
 * わんこのおやつ道はまだ検証中のため、特定ユーザーにのみ表示する。
 * 一覧・ゲーム画面・旧URLの3か所で同じ判定を使う。
 */
const SNACK_TRAIL_PREVIEW_USERS = ["しゅん", "さやか"];

export function canSeeSnackTrail(displayName: string): boolean {
  return SNACK_TRAIL_PREVIEW_USERS.includes(displayName);
}
