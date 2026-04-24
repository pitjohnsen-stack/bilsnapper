/**
 * Minimal fixed-window in-memory rate limiter. Pure and deterministic —
 * the caller supplies `now`, so tests don't need fake timers.
 *
 * Semantics: each key has a budget of `max` requests per `windowMs`.
 * Calling `allow(key, now)` consumes one token when available and returns
 * whether the request should be accepted.
 */
export interface RateLimiter {
  allow(key: string, now?: number): boolean;
  reset(): void;
  size(): number;
}

export function createRateLimiter(max: number, windowMs: number): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    allow(key, now = Date.now()) {
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (bucket.count >= max) return false;
      bucket.count += 1;
      return true;
    },
    reset() {
      buckets.clear();
    },
    size() {
      return buckets.size;
    },
  };
}
