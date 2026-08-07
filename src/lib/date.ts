/**
 * 日本時間の「今日」を YYYY-MM-DD で返す。
 *
 * `new Date().toISOString()` は UTC なので、UTC で動くサーバー（Vercel など）では
 * 日本時間 0:00〜9:00 のあいだ前日になってしまう。訪問日の初期値は必ずこれを使う。
 */
export function todayInJapan(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
