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

/** 「2分前」「3時間前」のような相対時刻表示。1分未満は「たった今」。 */
export function formatRelativeTimeJa(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "たった今";
  if (diffMinutes < 60) return `${diffMinutes}分前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}時間前`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}日前`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}ヶ月前`;

  return `${Math.floor(diffMonths / 12)}年前`;
}
