/**
 * SNS機能は準備中のため、管理者と一部の利用者だけに公開する。
 * 対象を増やす場合はここにメールアドレスを追加する。
 */
const SNS_ALLOWED_EMAILS = new Set(["for.administ@gmail.com", "n.shunta0415_ny@icloud.com"]);

export function canAccessSns(email: string | null | undefined): boolean {
  return !!email && SNS_ALLOWED_EMAILS.has(email.toLowerCase());
}
