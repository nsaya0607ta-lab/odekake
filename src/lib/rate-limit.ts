/**
 * 1ユーザーあたりの呼び出し回数の上限
 * =============================================================
 * Google Places はリクエストごとに課金される。ログインさえしていれば
 * 何度でも呼べる状態だと、連打や不具合のループでそのまま費用になる。
 *
 * 保存先はプロセスのメモリなので、インスタンスが複数あると
 * その数だけ上限が緩む。厳密な制限が要る場合は Redis などに移すこと。
 * ここでは「1人が短時間に大量に叩けない」ことだけを担保する。
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5_000;

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    // 溜まりすぎたら期限切れを掃除する（それでも多ければ全消し）
    if (buckets.size >= MAX_KEYS) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_KEYS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
