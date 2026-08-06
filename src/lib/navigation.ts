/**
 * 遷移先として受け取った文字列を、自サイト内のパスに限定する。
 * `//example.com` のようなプロトコル相対URLは外部サイトへ飛ぶため弾く。
 */
export function safeNextPath(value: string | null | undefined, fallback = "/home"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
