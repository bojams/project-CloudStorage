import { describe, expect, it } from "vitest";

import {
  FREE_PLAN,
  PLANS,
  PREMIUM_PLAN,
  getEffectivePlan,
  getPlan,
  isPremiumActive,
  isPremiumPlan,
} from "@/lib/plans";

const GIB = 1024 * 1024 * 1024;

describe("plan catalogue", () => {
  it("exposes exactly two tiers", () => {
    expect(Object.keys(PLANS).sort()).toEqual(["FREE", "PREMIUM"]);
  });

  it("gives the free tier less space than premium", () => {
    expect(FREE_PLAN.storageQuotaBytes).toBeLessThan(
      PREMIUM_PLAN.storageQuotaBytes,
    );
    expect(FREE_PLAN.storageQuotaBytes).toBe(5 * GIB);
    expect(PREMIUM_PLAN.storageQuotaBytes).toBe(1024 * GIB);
  });

  it("limits the file size per tier", () => {
    expect(FREE_PLAN.maxFileSizeBytes).toBe(100 * 1024 * 1024);
    expect(PREMIUM_PLAN.maxFileSizeBytes).toBe(2 * 1024 * 1024 * 1024);
  });

  it("keeps deleted files longer on premium", () => {
    expect(FREE_PLAN.trashRetentionDays).toBe(30);
    expect(PREMIUM_PLAN.trashRetentionDays).toBe(365);
  });

  it("enables the version history on premium only", () => {
    expect(FREE_PLAN.maxVersions).toBe(0);
    expect(PREMIUM_PLAN.maxVersions).toBeGreaterThan(0);
  });

  it("falls back to the free tier for unknown plans", () => {
    expect(getPlan("UNKNOWN").id).toBe("FREE");
    expect(getPlan(null).id).toBe("FREE");
    expect(isPremiumPlan("UNKNOWN")).toBe(false);
  });
});

describe("getEffectivePlan", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("keeps an active premium subscription", () => {
    const expiresAt = new Date("2026-12-31T00:00:00.000Z");
    expect(getEffectivePlan("PREMIUM", expiresAt, now).id).toBe("PREMIUM");
  });

  it("falls back to free when the subscription expired", () => {
    const expiresAt = new Date("2025-12-31T00:00:00.000Z");
    expect(getEffectivePlan("PREMIUM", expiresAt, now).id).toBe("FREE");
  });

  it("treats a missing expiry as unlimited", () => {
    expect(getEffectivePlan("PREMIUM", null, now).id).toBe("PREMIUM");
  });
});

describe("isPremiumActive", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("is false for the free tier", () => {
    expect(isPremiumActive("FREE", null, now)).toBe(false);
  });

  it("is true while the subscription is running", () => {
    expect(
      isPremiumActive("PREMIUM", new Date("2026-06-01T00:00:00.000Z"), now),
    ).toBe(true);
  });

  it("is false once the subscription ended", () => {
    expect(
      isPremiumActive("PREMIUM", new Date("2025-06-01T00:00:00.000Z"), now),
    ).toBe(false);
  });
});
