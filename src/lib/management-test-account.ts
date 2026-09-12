/**
 * 検証用の管理アカウント専用の制限
 * =============================================================
 * ユーザー名（profiles.display_name）が`MANAGEMENT_TEST_ACCOUNT_DISPLAY_NAME`と
 * 完全一致するアカウントだけ、アイテムキャッチの出現アイテムをこのリストに絞る
 * （ユーザー指定。新スキルを他のアイテムに紛れず集中して検証するための一時的な仕組み）。
 * 判定はJWT(user.displayName)ではなく、常に最新のprofilesを直接クエリして行うこと
 * （プロフィール編集直後の反映タイムラグを避けるため）。
 */
export const MANAGEMENT_TEST_ACCOUNT_DISPLAY_NAME = "管理用";

/**
 * アイテムキャッチの出現をこのリストに絞る（天然クエ握りの新規スキル検証用）。
 * 天然クエ握り自体に加え、そのスキル（画面上のマイナス系アイテムを時間増加系アイテムへ変化
 * させる）の変換先となる時間増加系13種も含める。これらが所持アイテムに1つも無いと変換先の
 * プールが空になり、スキルが常に「変化対象なし」になってしまうため（frenchie-catch-game.tsxの
 * TIME_BONUS_ITEM_IDSと同一、手動同期）。
 */
export const MANAGEMENT_TEST_ACCOUNT_ITEM_CATCH_IDS: readonly string[] = [
  "sushi_kue",
  "toy_duck_plush", "toy_carrot", "food_paw_melon_bread", "sushi_salmon", "sushi_buri", "sushi_bincho",
  "interior_anball", "other_omojii", "other_azuki", "sushi_otoro", "sushi_kani", "summer_frenchie", "other_burebur",
];

export function isManagementTestAccount(displayName: string | null | undefined): boolean {
  return displayName?.trim() === MANAGEMENT_TEST_ACCOUNT_DISPLAY_NAME;
}
