import { afterEach, describe, expect, it } from "vitest";

import {
  LIMITERS,
  getClientIdentifier,
  rateLimit,
} from "@/lib/security/rate-limit";

const globalStore = globalThis as unknown as { __rateLimitStore?: unknown };

afterEach(() => {
  delete globalStore.__rateLimitStore;
});

describe("rateLimit", () => {
  it("allows requests up to the limit", async () => {
    const results = [];
    for (let index = 0; index < 3; index += 1) {
      results.push(await rateLimit({ key: "test:allow", limit: 3, windowMs: 60_000 }));
    }

    expect(results.every((result) => result.success)).toBe(true);
    expect(results[2]?.remaining).toBe(0);
  });

  it("blocks requests beyond the limit", async () => {
    for (let index = 0; index < 2; index += 1) {
      await rateLimit({ key: "test:block", limit: 2, windowMs: 60_000 });
    }

    const blocked = await rateLimit({ key: "test:block", limit: 2, windowMs: 60_000 });
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("counts every key separately", async () => {
    await rateLimit({ key: "test:a", limit: 1, windowMs: 60_000 });
    const other = await rateLimit({ key: "test:b", limit: 1, windowMs: 60_000 });
    expect(other.success).toBe(true);
  });

  it("reports the moment the window resets", async () => {
    const result = await rateLimit({ key: "test:reset", limit: 5, windowMs: 30_000 });
    expect(result.reset).toBeGreaterThan(Date.now());
  });
});

describe("LIMITERS", () => {
  it("defines sane budgets for every operation", () => {
    for (const limiter of Object.values(LIMITERS)) {
      expect(limiter.limit).toBeGreaterThan(0);
      expect(limiter.windowMs).toBeGreaterThan(0);
    }
  });

  it("throttles sign-in attempts more aggressively than uploads", () => {
    expect(LIMITERS.login.limit).toBeLessThan(LIMITERS.upload.limit);
  });
});

describe("getClientIdentifier", () => {
  it("uses the first entry of x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" });
    expect(getClientIdentifier(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.4" });
    expect(getClientIdentifier(headers)).toBe("198.51.100.4");
  });

  it("falls back to a shared bucket when no header is present", () => {
    expect(getClientIdentifier(new Headers())).toBe("anonymous");
  });
});
