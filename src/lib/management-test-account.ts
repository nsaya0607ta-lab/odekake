/**
 * 検証用の管理アカウント専用の制限
 * =============================================================
 * ユーザー名（profiles.display_name、サインアップ以降は auth の user_metadata にも
 * 同期される）が`MANAGEMENT_TEST_ACCOUNT_DISPLAY_NAME`と完全一致するアカウントだけ、
 * ガチャとアイテムキャッチで出現アイテムを絞る（ユーザー指定）。
 * ガチャとアイテムキャッチは検証したい内容が違うことがあるため、別々のリストに分けている
 * （2026-09-12、ユーザー指定でアイテムキャッチだけ穴子握り1種に絞った際に分離した）。
 */
export const MANAGEMENT_TEST_ACCOUNT_DISPLAY_NAME = "管理用";

/** ガチャの排出をこのリストに絞る */
export const MANAGEMENT_TEST_ACCOUNT_GACHA_ITEM_IDS: readonly string[] = [
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

/** アイテムキャッチの出現をこのリストに絞る（触れるだけでキャッチ判定になる穴子握りの検証用） */
export const MANAGEMENT_TEST_ACCOUNT_ITEM_CATCH_IDS: readonly string[] = ["sushi_anago"];

export function isManagementTestAccount(displayName: string | null | undefined): boolean {
  return displayName?.trim() === MANAGEMENT_TEST_ACCOUNT_DISPLAY_NAME;
}
