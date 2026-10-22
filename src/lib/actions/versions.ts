"use server";

import { FileStatus, FileVersionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getStorageUsage, getUserPlan } from "@/lib/db/queries/account";
import { logServerError, toActionError } from "@/lib/errors";
import { fail, ok, type ActionResult } from "@/lib/result";
import { isAllowedMimeType } from "@/lib/security/mime";
import { buildVersionStorageKey, getStorageDriver } from "@/lib/storage";
import {
  versionCompleteSchema,
  versionSelectSchema,
  versionUploadRequestSchema,
} from "@/lib/validation/schemas";
import type { FileVersionSummary } from "@/types";

/**
 * Version history — a premium feature.
 *
 * The current bytes of a file always live at `File.storageKey`. Every older
 * revision is kept in its own `FileVersion` row with its own object key, so
 * restoring a revision never copies a (possibly huge) file around: the rows
 * simply swap the keys they point at.
 *
 *   upload a new revision  →  the current key is archived, the file points
 *                             at the freshly uploaded object
 *   restore a revision     →  the current key is archived, the file points
 *                             at the revision and the revision row is dropped
 *
 * A revision is reserved (`PENDING`) before the bytes are uploaded. The
 * reservation stores the content type, so the client cannot claim a
 * different type when the upload is confirmed.
 */

export interface VersionGrantResponse {
  readonly fileId: string;
  readonly versionId: string;
  readonly url: string;
  readonly method: "PUT";
  readonly headers: Record<string, string>;
  readonly expiresAt: number;
}

export interface VersionListResponse {
  readonly current: {
    readonly size: number;
    readonly mimeType: string;
    readonly updatedAt: string;
  } | null;
  readonly versions: readonly FileVersionSummary[];
}

/** Lists the archived revisions of a file. Premium only. */
export async function listFileVersionsAction(
  rawInput: unknown,
): Promise<ActionResult<VersionListResponse>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = versionSelectSchema.pick({ fileId: true }).parse(rawInput);

    const { isPremium } = await getUserPlan(user.id);
    if (!isPremium) {
      return fail("FORBIDDEN", "Version history is a premium feature.");
    }

    const file = await prisma.file.findFirst({
      where: { id: input.fileId, ownerId: user.id },
      select: {
        size: true,
        mimeType: true,
        updatedAt: true,
        versions: {
          where: { status: FileVersionStatus.READY },
          orderBy: { versionNumber: "desc" },
          select: {
            id: true,
            versionNumber: true,
            size: true,
            mimeType: true,
            createdAt: true,
          },
        },
      },
    });

    if (!file) return fail("NOT_FOUND", "File not found.");

    return ok({
      current: {
        size: Number(file.size),
        mimeType: file.mimeType,
        updatedAt: file.updatedAt.toISOString(),
      },
      versions: file.versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        size: Number(version.size),
        mimeType: version.mimeType,
        createdAt: version.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logServerError("listFileVersionsAction", error);
    return { ok: false, error: toActionError(error) };
  }
}

/**
 * Reserves the storage for a new revision and returns the upload grant.
 * The bytes are uploaded exactly like a regular file.
 */
export async function requestVersionUploadAction(
  rawInput: unknown,
): Promise<ActionResult<VersionGrantResponse>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = versionUploadRequestSchema.parse(rawInput);

    const { effective, isPremium } = await getUserPlan(user.id);
    if (!isPremium) {
      return fail("FORBIDDEN", "Version history is a premium feature.");
    }

    if (!isAllowedMimeType(input.mimeType)) {
      return fail(
        "UNSUPPORTED_MEDIA",
        `Files of type "${input.mimeType}" cannot be uploaded.`,
      );
    }

    if (input.size > effective.maxFileSizeBytes) {
      return fail(
        "VALIDATION_ERROR",
        "The new revision is larger than the file size limit of your plan.",
      );
    }

    const file = await prisma.file.findFirst({
      where: {
        id: input.fileId,
        ownerId: user.id,
        isTrashed: false,
        status: FileStatus.READY,
      },
      select: {
        id: true,
        _count: { select: { versions: true } },
      },
    });

    if (!file) return fail("NOT_FOUND", "File not found.");

    if (file._count.versions >= effective.maxVersions) {
      return fail(
        "CONFLICT",
        `You already keep ${effective.maxVersions} revisions of this file. Delete one before uploading a new revision.`,
      );
    }

    const usage = await getStorageUsage(user.id);
    if (usage.quota > 0 && usage.used + input.size > usage.quota) {
      return fail(
        "QUOTA_EXCEEDED",
        "This revision would exceed your storage limit. Free up some space and try again.",
      );
    }

    // A previous, unfinished upload of the same file is discarded.
    await discardPendingVersions(user.id, file.id);

    const versionId = crypto.randomUUID();
    const storageKey = buildVersionStorageKey(user.id, file.id, versionId);

    const driver = getStorageDriver();
    const grant = await driver.createUploadGrant({
      key: storageKey,
      contentType: input.mimeType,
      maxSize: input.size,
    });

    await prisma.fileVersion.create({
      data: {
        id: versionId,
        fileId: file.id,
        storageKey,
        size: BigInt(input.size),
        mimeType: input.mimeType,
        versionNumber: 0,
        status: FileVersionStatus.PENDING,
      },
    });

    return ok({
      fileId: file.id,
      versionId,
      url: grant.url,
      method: grant.method,
      headers: { ...grant.headers },
      expiresAt: grant.expiresAt,
    });
  } catch (error) {
    logServerError("requestVersionUploadAction", error);
    return { ok: false, error: toActionError(error) };
  }
}

/**
 * Finishes a revision upload: the previous content is archived and the file
 * points at the newly uploaded object.
 */
export async function completeVersionUploadAction(
  rawInput: unknown,
): Promise<ActionResult<{ fileId: string; versionNumber: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = versionCompleteSchema.parse(rawInput);

    const { effective, isPremium } = await getUserPlan(user.id);
    if (!isPremium) {
      return fail("FORBIDDEN", "Version history is a premium feature.");
    }

    const file = await prisma.file.findFirst({
      where: {
        id: input.fileId,
        ownerId: user.id,
        isTrashed: false,
        status: FileStatus.READY,
      },
      select: {
        id: true,
        size: true,
        mimeType: true,
        storageKey: true,
      },
    });

    if (!file) return fail("NOT_FOUND", "File not found.");

    const pending = await prisma.fileVersion.findFirst({
      where: {
        id: input.versionId,
        fileId: file.id,
        status: FileVersionStatus.PENDING,
      },
      select: { id: true, storageKey: true, size: true, mimeType: true },
    });

    if (!pending) return fail("NOT_FOUND", "The reserved revision is gone.");

    const driver = getStorageDriver();
    const stat = await driver.statObject(pending.storageKey);

    if (!stat || stat.size !== Number(pending.size)) {
      await prisma.fileVersion.delete({ where: { id: pending.id } });
      await driver.deleteObject(pending.storageKey).catch(() => undefined);
      return fail("STORAGE_ERROR", "The revision could not be verified.");
    }

    const latest = await prisma.fileVersion.findFirst({
      where: { fileId: file.id, status: FileVersionStatus.READY },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    const versionNumber = (latest?.versionNumber ?? 0) + 1;

    // The current bytes become a revision…
    await prisma.fileVersion.create({
      data: {
        fileId: file.id,
        storageKey: file.storageKey,
        size: file.size,
        mimeType: file.mimeType,
        versionNumber,
        status: FileVersionStatus.READY,
      },
    });

    // …and the file points at the newly uploaded object.
    await prisma.file.update({
      where: { id: file.id },
      data: {
        storageKey: pending.storageKey,
        size: pending.size,
        mimeType: pending.mimeType,
        updatedAt: new Date(),
      },
    });

    await prisma.fileVersion.delete({ where: { id: pending.id } });

    await pruneVersions(user.id, file.id, effective.maxVersions);

    revalidatePath("/drive", "layout");
    revalidatePath("/recent", "layout");

    return ok({ fileId: file.id, versionNumber });
  } catch (error) {
    logServerError("completeVersionUploadAction", error);
    return { ok: false, error: toActionError(error) };
  }
}

/**
 * Restores an archived revision. The current content is archived first, so
 * a restore can always be undone.
 */
export async function restoreFileVersionAction(
  rawInput: unknown,
): Promise<ActionResult<{ fileId: string; versionNumber: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = versionSelectSchema.parse(rawInput);

    const { effective, isPremium } = await getUserPlan(user.id);
    if (!isPremium) {
      return fail("FORBIDDEN", "Version history is a premium feature.");
    }

    const file = await prisma.file.findFirst({
      where: { id: input.fileId, ownerId: user.id },
      select: {
        id: true,
        size: true,
        mimeType: true,
        storageKey: true,
      },
    });

    if (!file) return fail("NOT_FOUND", "File not found.");

    const version = await prisma.fileVersion.findFirst({
      where: {
        id: input.versionId,
        fileId: file.id,
        status: FileVersionStatus.READY,
      },
      select: {
        id: true,
        storageKey: true,
        size: true,
        mimeType: true,
        versionNumber: true,
      },
    });

    if (!version) return fail("NOT_FOUND", "Revision not found.");

    const latest = await prisma.fileVersion.findFirst({
      where: { fileId: file.id, status: FileVersionStatus.READY },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    const versionNumber = (latest?.versionNumber ?? 0) + 1;

    // Archive the current bytes, then let the file take over the key of the
    // restored revision. The revision row itself is removed afterwards.
    await prisma.fileVersion.create({
      data: {
        fileId: file.id,
        storageKey: file.storageKey,
        size: file.size,
        mimeType: file.mimeType,
        versionNumber,
        status: FileVersionStatus.READY,
      },
    });

    await prisma.file.update({
      where: { id: file.id },
      data: {
        storageKey: version.storageKey,
        size: version.size,
        mimeType: version.mimeType,
        updatedAt: new Date(),
      },
    });

    await prisma.fileVersion.delete({ where: { id: version.id } });

    await pruneVersions(user.id, file.id, effective.maxVersions);

    revalidatePath("/drive", "layout");
    revalidatePath("/recent", "layout");

    return ok({ fileId: file.id, versionNumber });
  } catch (error) {
    logServerError("restoreFileVersionAction", error);
    return { ok: false, error: toActionError(error) };
  }
}

/** Deletes a single archived revision. */
export async function deleteFileVersionAction(
  rawInput: unknown,
): Promise<ActionResult<{ fileId: string; versionId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = versionSelectSchema.parse(rawInput);

    const { isPremium } = await getUserPlan(user.id);
    if (!isPremium) {
      return fail("FORBIDDEN", "Version history is a premium feature.");
    }

    const version = await prisma.fileVersion.findFirst({
      where: {
        id: input.versionId,
        fileId: input.fileId,
        file: { ownerId: user.id },
      },
      select: { id: true, fileId: true, storageKey: true },
    });

    if (!version) return fail("NOT_FOUND", "Revision not found.");

    await prisma.fileVersion.delete({ where: { id: version.id } });

    const driver = getStorageDriver();
    await driver.deleteObject(version.storageKey).catch(() => undefined);

    revalidatePath("/drive", "layout");

    return ok({ fileId: version.fileId, versionId: version.id });
  } catch (error) {
    logServerError("deleteFileVersionAction", error);
    return { ok: false, error: toActionError(error) };
  }
}

/**
 * Keeps the number of revisions within the plan limit by dropping the
 * oldest ones — including their objects in the store.
 */
async function pruneVersions(
  userId: string,
  fileId: string,
  maxVersions: number,
): Promise<void> {
  if (maxVersions <= 0) return;

  const versions = await prisma.fileVersion.findMany({
    where: { fileId, file: { ownerId: userId }, status: FileVersionStatus.READY },
    orderBy: { versionNumber: "desc" },
    select: { id: true, storageKey: true },
  });

  const surplus = versions.slice(maxVersions);
  if (surplus.length === 0) return;

  await prisma.fileVersion.deleteMany({
    where: { id: { in: surplus.map((version) => version.id) } },
  });

  const driver = getStorageDriver();
  await Promise.all(
    surplus.map((version) =>
      driver.deleteObject(version.storageKey).catch(() => undefined),
    ),
  );
}

/** Removes reservations of uploads that were never confirmed. */
async function discardPendingVersions(
  userId: string,
  fileId: string,
): Promise<void> {
  const pending = await prisma.fileVersion.findMany({
    where: {
      fileId,
      file: { ownerId: userId },
      status: FileVersionStatus.PENDING,
    },
    select: { id: true, storageKey: true },
  });

  if (pending.length === 0) return;

  await prisma.fileVersion.deleteMany({
    where: { id: { in: pending.map((version) => version.id) } },
  });

  const driver = getStorageDriver();
  await Promise.all(
    pending.map((version) =>
      driver.deleteObject(version.storageKey).catch(() => undefined),
    ),
  );
}
