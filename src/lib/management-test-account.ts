/**
 * 検証用の管理アカウント専用の制限
 * =============================================================
 * ユーザー名（profiles.display_name、サインアップ以降は auth の user_metadata にも
 * 同期される）が`MANAGEMENT_TEST_ACCOUNT_DISPLAY_NAME`と完全一致するアカウントだけ、
 * ガチャ・アイテムキャッチの両方で出現アイテムをこのリストに絞る（ユーザー指定）。
 * 元々は「直近追加した10種」だったが、2026-09-12にユーザー指定で穴子握り（触れるだけで
 * キャッチ判定になるスキルの検証用）を追加し11種になった。新しく検証したいアイテムが
 * 増えたら、このリストへ追加すればよい（件数を10に揃える必要はない）。
 */
export const MANAGEMENT_TEST_ACCOUNT_DISPLAY_NAME = "管理用";

export const MANAGEMENT_TEST_ACCOUNT_ITEM_IDS: readonly string[] = [
  "sushi_kuruma_ebi",
  "sushi_kazunoko",
  "sushi_nodoguro",
  "sushi_unagi",
  "sushi_oomonhata",
  "sushi_kani",
  "sushi_fugu",
  "sushi_mirugai",
  "sushi_onion_salmon",
  "sushi_engawa",
  "sushi_anago",
];

export function isManagementTestAccount(displayName: string | null | undefined): boolean {
  return displayName?.trim() === MANAGEMENT_TEST_ACCOUNT_DISPLAY_NAME;
}
