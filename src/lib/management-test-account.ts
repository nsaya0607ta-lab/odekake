/**
 * 検証用の管理アカウント専用の制限
 * =============================================================
 * ユーザー名（profiles.display_name、サインアップ以降は auth の user_metadata にも
 * 同期される）が`MANAGEMENT_TEST_ACCOUNT_DISPLAY_NAME`と完全一致するアカウントだけ、
 * ガチャ・アイテムキャッチの両方で出現アイテムを直近追加した10種に絞る（ユーザー指定）。
 * 新しく寿司シリーズ等にアイテムを追加したときは、このリストを更新すること
 * （最新のリスト＝itemsを追加した順で末尾10種、docs/item-catch-new-item-checklist.md・
 * docs/minigame-time-balance.mdの追加履歴と突き合わせて判断する）。
 */
export const MANAGEMENT_TEST_ACCOUNT_DISPLAY_NAME = "管理用";

/** 2026-09-12時点で直近に追加した10種（新しい順） */
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
];

export function isManagementTestAccount(displayName: string | null | undefined): boolean {
  return displayName === MANAGEMENT_TEST_ACCOUNT_DISPLAY_NAME;
}
