/**
 * ダンボールガチャは実験公開中のため、限定ユーザーにのみ表示・利用を許可する。
 * 一般公開のタイミングでこのチェックごと削除する。
 */
const ALLOWED_EMAILS = new Set(["for.administ@gmail.com"]);

export function isDambourleGachaEnabled(email: string | null): boolean {
  return email !== null && ALLOWED_EMAILS.has(email);
}
