import "server-only";

import { FileStatus } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import {
  getEffectivePlan,
  type PlanDefinition,
  type PlanId,
} from "@/lib/plans";

/**
 * Read model for the account itself: profile, photo and subscription.
 *
 * Everything the settings screen and the application shell need is fetched
 * with a single round trip (three queries executed in parallel), so the
 * layout does not have to wait for several round trips.
 */

export interface UserPlan {
  readonly plan: PlanId;
  readonly planExpiresAt: Date | null;
  /** The tier that is enforced right now (premium falls back to free). */
  readonly effective: PlanDefinition;
  readonly isPremium: boolean;
}

export interface AccountOverview {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: "USER" | "ADMIN";
  /** Public URL of the profile photo, or `null` when none was uploaded. */
  readonly avatarUrl: string | null;
  /** Subscription tier of the account. */
  readonly plan: PlanId;
  /** Expiry of the subscription as an ISO string (JSON safe). */
  readonly planExpiresAt: string | null;
  /** The tier that is enforced right now. */
  readonly effective: PlanDefinition;
  /** True while the premium features are unlocked. */
  readonly isPremium: boolean;
  readonly storageQuota: number;
  readonly used: number;
  readonly fileCount: number;
}

export interface StorageUsage {
  readonly used: number;
  readonly quota: number;
  readonly fileCount: number;
}

/** Reads the plan of a user straight from the database. */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  if (!userId) {
    return {
      plan: "FREE",
      planExpiresAt: null,
      effective: getEffectivePlan("FREE", null),
      isPremium: false,
    };
  }

  const record = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, planExpiresAt: true },
  });

  const plan = (record?.plan ?? "FREE") as PlanId;
  const planExpiresAt = record?.planExpiresAt ?? null;
  const effective = getEffectivePlan(plan, planExpiresAt);

  return {
    plan,
    planExpiresAt,
    effective,
    isPremium: effective.id === "PREMIUM",
  };
}

/**
 * Storage usage of an account.
 *
 * Archived revisions count towards the quota as well — they are real bytes
 * stored in the object store.
 */
export async function getStorageUsage(ownerId: string): Promise<StorageUsage> {
  const [aggregate, versions, user] = await Promise.all([
    prisma.file.aggregate({
      where: { ownerId, isTrashed: false, status: FileStatus.READY },
      _sum: { size: true },
      _count: { _all: true },
    }),
    prisma.fileVersion.aggregate({
      where: { file: { ownerId, isTrashed: false, status: FileStatus.READY } },
      _sum: { size: true },
    }),
    prisma.user.findUnique({
      where: { id: ownerId },
      select: { plan: true, planExpiresAt: true, storageQuota: true },
    }),
  ]);

  const effective = getEffectivePlan(
    user?.plan ?? "FREE",
    user?.planExpiresAt ?? null,
  );

  return {
    used:
      Number(aggregate._sum.size ?? 0) + Number(versions._sum.size ?? 0),
    quota: effective.storageQuotaBytes,
    fileCount: aggregate._count._all,
  };
}

/** Everything the shell and the settings screen display. */
export async function getAccountOverview(
  ownerId: string,
): Promise<AccountOverview | null> {
  const [user, usage] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        imageKey: true,
        imageUpdatedAt: true,
        plan: true,
        planExpiresAt: true,
      },
    }),
    getStorageUsage(ownerId),
  ]);

  if (!user) return null;

  const plan = (user.plan ?? "FREE") as PlanId;
  const planExpiresAt = user.planExpiresAt ?? null;
  const effective = getEffectivePlan(plan, planExpiresAt);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.imageKey ? buildAvatarUrl(user.imageUpdatedAt) : null,
    plan,
    planExpiresAt: planExpiresAt ? planExpiresAt.toISOString() : null,
    effective,
    isPremium: effective.id === "PREMIUM",
    storageQuota: usage.quota,
    used: usage.used,
    fileCount: usage.fileCount,
  };
}

/**
 * The photo is served by an authenticated endpoint, so the URL carries a
 * cache busting timestamp. The bytes themselves are protected by the
 * session cookie.
 */
export function buildAvatarUrl(updatedAt: Date | null | undefined): string {
  const version = updatedAt ? updatedAt.getTime() : 0;
  return `/api/profile/avatar?v=${version}`;
}
