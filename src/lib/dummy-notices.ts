/**
 * お知らせのダミーデータ。
 *
 * まだお知らせ機能のDBテーブルが無いので、実データが用意できるまでの仮の内容。
 * 本実装時はこのファイルを削除し、DBから取得する処理に差し替える。
 */
export type NoticeItem = {
  id: string;
  title: string;
  publishedAt: string;
};

export const DUMMY_NOTICES: NoticeItem[] = [
  { id: "1", title: "新しいミニゲームを追加しました", publishedAt: "2026-08-10" },
  { id: "2", title: "歩数連携の不具合を修正しました", publishedAt: "2026-08-05" },
  { id: "3", title: "フレンド機能をリリースしました", publishedAt: "2026-07-28" },
];
