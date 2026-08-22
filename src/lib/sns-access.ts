/**
 * SNS機能は正式に全ユーザーへ公開済み。
 */
export function canAccessSns(_email: string | null | undefined): boolean {
  return true;
}
