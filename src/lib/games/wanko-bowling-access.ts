/**
 * わんこボウリングの限定公開設定
 * =============================================================
 * 実験中のため、動作確認用の特定アカウントにだけ公開する。
 * 一般公開する際はこのファイルごと削除し、呼び出し側のチェックも外すこと。
 */

const WANKO_BOWLING_ALLOWED_EMAILS = new Set(["n.shunta0415_ny@icloud.com".toLowerCase()]);
const WANKO_BOWLING_ALLOWED_DISPLAY_NAMES = new Set(["さやか"]);

export function canAccessWankoBowling(
  email: string | null | undefined,
  displayName?: string | null,
): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail && WANKO_BOWLING_ALLOWED_EMAILS.has(normalizedEmail)) return true;

  const normalizedDisplayName = displayName?.trim().normalize("NFKC");
  if (!normalizedDisplayName) return false;
  return WANKO_BOWLING_ALLOWED_DISPLAY_NAMES.has(normalizedDisplayName);
}
