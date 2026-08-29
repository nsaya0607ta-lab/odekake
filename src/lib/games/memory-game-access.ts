/**
 * しん犬すいじゃくはまだ検証中のため、特定ユーザーにのみ表示する。
 */
const MEMORY_GAME_PREVIEW_USERS = ["しゅん"];

export function canSeeMemoryGame(displayName: string): boolean {
  return MEMORY_GAME_PREVIEW_USERS.includes(displayName);
}
