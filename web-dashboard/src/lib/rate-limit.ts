/**
 * Basit bellek içi kaba kuvvet (brute force) koruması.
 * Tek sunucu süreci için yeterlidir; canlı ortamda Nginx `limit_req` ile desteklenmelidir.
 */

interface Bucket {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const MAX_KEYS = 10_000;

const buckets = new Map<string, Bucket>();

function prune(now: number): void {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, b] of buckets) {
    if (b.lockedUntil < now && now - b.firstFailureAt > WINDOW_MS) buckets.delete(key);
  }
}

/** Kilitliyse kalan saniyeyi, değilse 0 döner. */
export function lockRemainingSeconds(key: string, now = Date.now()): number {
  const b = buckets.get(key);
  if (!b || b.lockedUntil <= now) return 0;
  return Math.ceil((b.lockedUntil - now) / 1000);
}

export function registerFailure(key: string, now = Date.now()): void {
  prune(now);
  const prev = buckets.get(key);
  const fresh = !prev || now - prev.firstFailureAt > WINDOW_MS;
  const failures = fresh || !prev ? 1 : prev.failures + 1;
  buckets.set(key, {
    failures,
    firstFailureAt: fresh || !prev ? now : prev.firstFailureAt,
    lockedUntil: failures >= MAX_FAILURES ? now + LOCK_MS : 0
  });
}

export function clearFailures(key: string): void {
  buckets.delete(key);
}

/** İstemci IP adresi (proxy arkasında X-Forwarded-For ilk değeri). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || "127.0.0.1";
}
