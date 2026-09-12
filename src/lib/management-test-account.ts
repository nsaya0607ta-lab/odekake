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
 * 天然クエ握り自体に加え、そのスキル（画面上のマイナス系アイテムを得点倍率系アイテムへ変化
 * させる）の変換先となる得点倍率系アイテムも含める。これらが所持アイテムに1つも無いと変換先の
 * プールが空になり、スキルが常に「変化対象なし」になってしまうため（frenchie-catch-game.tsxの
 * SCORE_MULT_CONVERT_ITEM_IDSと同一、手動同期）。
 */
export const MANAGEMENT_TEST_ACCOUNT_ITEM_CATCH_IDS: readonly string[] = [
  "sushi_kue",
  "toy_meat", "interior_spring_flower_wreath", "other_kamunayo", "other_nisoku_a", "other_azubee",
  "interior_kinoko_azubee", "other_kobee", "interior_shikkoku_no_ar", "other_pink_omo",
  "other_narcissist_a", "other_mafia_a", "sushi_maguro_akami", "sushi_chutoro", "sushi_uni",
  "sushi_fugu", "sushi_nama_ebi", "sushi_negishio_maguro", "sushi_akagai", "sushi_awabi",
];

export function isManagementTestAccount(displayName: string | null | undefined): boolean {
  return displayName?.trim() === MANAGEMENT_TEST_ACCOUNT_DISPLAY_NAME;
}
