/**
 * Rate limiting (OWASP A04 — Insecure Design / A07 — Identification &
 * Authentication Failures).
 *
 * A fixed-window counter is used. Two stores are available:
 *  * `memory` — zero dependency, per-process. Perfect for a single instance
 *    and for local development.
 *  * `upstash` — Redis over REST, edge compatible, required when the app is
 *    deployed on several instances.
 *
 * Configure the Redis store with `UPSTASH_REDIS_REST_URL` and
 * `UPSTASH_REDIS_REST_TOKEN`.
 */

export interface RateLimitResult {
  readonly success: boolean;
  readonly limit: number;
  readonly remaining: number;
  /** Unix timestamp (ms) when the current window resets. */
  readonly reset: number;
}

export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

const globalStore = globalThis as unknown as {
  __rateLimitStore?: RateLimitStore;
};

class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      this.sweep(now);
      return { count: 1, resetAt };
    }

    existing.count += 1;
    return { count: existing.count, resetAt: existing.resetAt };
  }

  /** Removes expired buckets so the map cannot grow without bound. */
  private sweep(now: number): void {
    if (this.buckets.size < 5_000) return;

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

class UpstashRateLimitStore implements RateLimitStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  async hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const response = await fetch(`${this.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["PEXPIRE", key, String(windowMs)],
        ["PTTL", key],
      ]),
      cache: "no-store",
    });

    if (!response.ok) {
      // Fail open: a rate-limiter outage must not take the whole app down.
      return { count: 1, resetAt: Date.now() + windowMs };
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      return { count: 1, resetAt: Date.now() + windowMs };
    }

    const count = Number(payload[0]);
    const ttl = Number(payload[2]);
    const resetAt = Date.now() + (Number.isFinite(ttl) ? ttl : windowMs);

    return { count: Number.isFinite(count) ? count : 1, resetAt };
  }
}

function resolveStore(): RateLimitStore {
  if (globalStore.__rateLimitStore) return globalStore.__rateLimitStore;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const store =
    url && token ? new UpstashRateLimitStore(url, token) : new MemoryRateLimitStore();

  globalStore.__rateLimitStore = store;
  return store;
}

/** Executes (or rejects) a single rate-limited operation. */
export async function rateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const store = resolveStore();
  const { count, resetAt } = await store.hit(options.key, options.windowMs);

  return {
    success: count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    reset: resetAt,
  };
}

/** Named limiters used across the app. */
export const LIMITERS = {
  /** Sign-in attempts per IP. */
  login: { limit: 8, windowMs: 10 * 60 * 1000 },
  /** Account creation per IP. */
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  /** Upload initiations per user. */
  upload: { limit: 120, windowMs: 60 * 1000 },
  /** Uploaded bytes per user (weighted by size). */
  uploadBytes: { limit: 200, windowMs: 60 * 1000 },
  /** Generic mutation guard. */
  mutation: { limit: 60, windowMs: 60 * 1000 },
} as const;

/**
 * Best-effort client identifier.
 *
 * `x-forwarded-for` is only trustworthy when the app sits behind a proxy that
 * overwrites the header (Vercel, Cloudflare, nginx, …).
 */
export function getClientIdentifier(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "anonymous";
}
