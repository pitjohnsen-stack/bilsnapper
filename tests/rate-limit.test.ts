import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../src/lib/rate-limit';

describe('rate-limit', () => {
  it('allows up to `max` requests per window', () => {
    const rl = createRateLimiter(3, 1000);
    expect(rl.allow('a', 0)).toBe(true);
    expect(rl.allow('a', 10)).toBe(true);
    expect(rl.allow('a', 20)).toBe(true);
    expect(rl.allow('a', 30)).toBe(false);
  });

  it('resets the bucket after the window expires', () => {
    const rl = createRateLimiter(2, 1000);
    expect(rl.allow('a', 0)).toBe(true);
    expect(rl.allow('a', 500)).toBe(true);
    expect(rl.allow('a', 900)).toBe(false);
    expect(rl.allow('a', 1500)).toBe(true); // new window
    expect(rl.allow('a', 1600)).toBe(true);
    expect(rl.allow('a', 1700)).toBe(false);
  });

  it('tracks buckets independently per key', () => {
    const rl = createRateLimiter(1, 1000);
    expect(rl.allow('a', 0)).toBe(true);
    expect(rl.allow('b', 0)).toBe(true);
    expect(rl.allow('a', 10)).toBe(false);
    expect(rl.allow('b', 10)).toBe(false);
  });

  it('reset() clears all buckets', () => {
    const rl = createRateLimiter(1, 1000);
    rl.allow('a', 0);
    rl.allow('b', 0);
    expect(rl.size()).toBe(2);
    rl.reset();
    expect(rl.size()).toBe(0);
    expect(rl.allow('a', 10)).toBe(true);
  });
});
