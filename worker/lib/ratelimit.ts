import type { Env } from '../env';
import { HttpError } from './http';

/**
 * Fixed-window limiter stored in D1 (one row per bucket). Good enough for auth brute-force,
 * AI cost control and proxy abuse at this app's scale; swap for the Workers Rate Limiting
 * binding if traffic grows.
 */
export async function rateLimit(env: Env, bucket: string, max: number, windowSec: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (now % windowSec);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(bucket) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = ?2 THEN rate_limits.count + 1 ELSE 1 END,
       window_start = ?2
     RETURNING count`,
  )
    .bind(bucket, start)
    .first<{ count: number }>();
  const scale = Math.max(1, Number(env.RATE_LIMIT_SCALE ?? 1) || 1);
  if ((row?.count ?? 0) > max * scale) {
    throw new HttpError(429, 'rate_limited', 'محاولات كثيرة، حاول بعد قليل');
  }
}
