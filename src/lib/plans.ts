/**
 * Subscription catalogue.
 *
 * The file is deliberately free of any server-only import so that both the
 * server actions and the client components can read it: the settings screen
 * renders the very same numbers the server enforces.
 *
 * The plan is the single source of truth for the limits. The `storageQuota`
 * column on the user is only a mirror of the active plan, so a downgrade
 * immediately shrinks the allowance as well.
 */

export type PlanId = "FREE" | "PREMIUM";

export interface PlanFeature {
  readonly label: string;
  /** `true` when the feature is part of the premium tier. */
  readonly premium: boolean;
}

export interface PlanDefinition {
  readonly id: PlanId;
  readonly name: string;
  readonly tagline: string;
  /** Monthly price in cents — used for display only, no payment is taken. */
  readonly priceCents: number;
  readonly currency: string;
  /** Storage allowance in bytes. */
  readonly storageQuotaBytes: number;
  /** Maximum size of a single file in bytes. */
  readonly maxFileSizeBytes: number;
  /** Number of days deleted items are kept in the trash. */
  readonly trashRetentionDays: number;
  /** Number of older revisions that are kept per file (0 = disabled). */
  readonly maxVersions: number;
  readonly features: readonly PlanFeature[];
}

const GIB = 1024 * 1024 * 1024;
const MIB = 1024 * 1024;

export const FREE_PLAN: PlanDefinition = {
  id: "FREE",
  name: "Free",
  tagline: "Everything you need to keep your documents in one place.",
  priceCents: 0,
  currency: "USD",
  storageQuotaBytes: 5 * GIB,
  maxFileSizeBytes: 100 * MIB,
  trashRetentionDays: 30,
  maxVersions: 0,
  features: [
    { label: "5 GB of storage", premium: false },
    { label: "Upload files up to 100 MB", premium: false },
    { label: "Deleted files kept for 30 days", premium: false },
    { label: "1 TB of storage", premium: true },
    { label: "Upload files up to 2 GB", premium: true },
    { label: "Deleted files kept for 365 days", premium: true },
    { label: "Version history with restore (25 revisions)", premium: true },
  ],
};

export const PREMIUM_PLAN: PlanDefinition = {
  id: "PREMIUM",
  name: "Premium",
  tagline: "More space, bigger files and a safety net for every revision.",
  priceCents: 999,
  currency: "USD",
  storageQuotaBytes: 1024 * GIB,
  maxFileSizeBytes: 2 * 1024 * MIB,
  trashRetentionDays: 365,
  maxVersions: 25,
  features: FREE_PLAN.features,
};

export const PLANS: Readonly<Record<PlanId, PlanDefinition>> = {
  FREE: FREE_PLAN,
  PREMIUM: PREMIUM_PLAN,
};

export const PLAN_ORDER: readonly PlanId[] = ["FREE", "PREMIUM"];

export function getPlan(planId: string | null | undefined): PlanDefinition {
  if (planId === "PREMIUM") return PREMIUM_PLAN;
  return FREE_PLAN;
}

export function isPremiumPlan(planId: string | null | undefined): boolean {
  return getPlan(planId).id === "PREMIUM";
}

/** True when the plan is premium and has not expired yet. */
export function isPremiumActive(
  planId: string | null | undefined,
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!isPremiumPlan(planId)) return false;
  if (!expiresAt) return true;
  return expiresAt.getTime() > now.getTime();
}

/**
 * The plan that is actually enforced right now. A premium subscription that
 * has expired silently falls back to the free tier.
 */
export function getEffectivePlan(
  planId: string | null | undefined,
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): PlanDefinition {
  const plan = getPlan(planId);
  if (plan.id === "PREMIUM" && expiresAt && expiresAt.getTime() <= now.getTime()) {
    return FREE_PLAN;
  }
  return plan;
}
