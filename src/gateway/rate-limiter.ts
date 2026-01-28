/**
 * Sliding-window rate limiter keyed by IP address.
 *
 * Uses a simple token-bucket approach with automatic cleanup of stale entries.
 */

type BucketEntry = {
  /** Number of tokens consumed in the current window. */
  count: number;
  /** Start of the current window (ms). */
  windowStart: number;
};

export type RateLimiterConfig = {
  /** Maximum requests allowed per window. */
  maxPerWindow: number;
  /** Window duration in milliseconds. */
  windowMs: number;
};

export class RateLimiter {
  private readonly buckets = new Map<string, BucketEntry>();
  private readonly maxPerWindow: number;
  private readonly windowMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimiterConfig) {
    this.maxPerWindow = config.maxPerWindow;
    this.windowMs = config.windowMs;
    // Periodically clean stale entries to prevent memory leaks.
    this.cleanupTimer = setInterval(() => this.cleanup(), this.windowMs * 2);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  /**
   * Check if the given key is within the rate limit and increment the counter.
   * Returns `true` if allowed, `false` if rate-limited.
   */
  check(key: string): boolean {
    const now = Date.now();
    const entry = this.buckets.get(key);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.maxPerWindow) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Check if the given key is within the rate limit without incrementing.
   * Returns `true` if allowed, `false` if rate-limited.
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.buckets.get(key);
    if (!entry || now - entry.windowStart >= this.windowMs) return true;
    return entry.count < this.maxPerWindow;
  }

  /**
   * Record an event for the given key (increment the counter).
   * Use this for tracking failures separately from the allow check.
   */
  record(key: string): void {
    const now = Date.now();
    const entry = this.buckets.get(key);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return;
    }
    entry.count++;
  }

  /** Remove entries whose windows have expired. */
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.buckets) {
      if (now - entry.windowStart >= this.windowMs) {
        this.buckets.delete(key);
      }
    }
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.buckets.clear();
  }
}
