import type { Env } from './types';

const WINDOW_MINUTES = 60;
const MAX_PER_WINDOW = 5; // 5 signups per IP per hour

/**
 * Check and increment rate limit. Returns true if request is allowed.
 */
export async function checkRateLimit(env: Env, key: string): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000).toISOString();

  // Clean expired entries and check current count
  await env.DB.prepare(
    `DELETE FROM rate_limits WHERE window_start < ?`
  ).bind(windowStart).run();

  const existing = await env.DB.prepare(
    `SELECT count, window_start FROM rate_limits WHERE key = ?`
  ).bind(key).first<{ count: number; window_start: string }>();

  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)`
    ).bind(key, now.toISOString()).run();
    return true;
  }

  if (existing.count >= MAX_PER_WINDOW) {
    return false;
  }

  await env.DB.prepare(
    `UPDATE rate_limits SET count = count + 1 WHERE key = ?`
  ).bind(key).run();
  return true;
}
