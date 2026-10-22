"use server";

import { FileStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getStorageUsage, getUserPlan } from "@/lib/db/queries/account";
import { logServerError, toActionError } from "@/lib/errors";
import { fail, ok, type ActionResult } from "@/lib/result";
import { LIMITERS, rateLimit } from "@/lib/security/rate-limit";
import { isAllowedMimeType } from "@/lib/security/mime";
import { SanitizationError, sanitizeName, toNameKey } from "@/lib/security/sanitize";
import { getStorageDriver, buildStorageKey } from "@/lib/storage";
import {
  abortUploadSchema,
  completeUploadSchema,
  uploadRequestSchema,
} from "@/lib/validation/schemas";

/**
 * Upload orchestration.
 *
 * The browser never sends file bytes through a server action. Instead:
 *
 *   1. `requestUploadAction`  — validates the metadata, reserves a row and
 *                                returns a short-lived upload grant.
 *   2. the browser PUTs the bytes directly to the grant URL (S3 presigned PUT
 *      or the local `/api/files/upload` endpoint) with real-time progress.
 *   3. `completeUploadAction` — verifies the object exists and that its size
 *                                matches the reservation, then flips the row to
 *                                `READY`.
 *
 * This keeps large payloads off the Next.js server (no memory exhaustion),
 * provides genuine upload progress, and makes every step auditable.
 */

export interface UploadGrantResponse {
  readonly fileId: string;
  readonly url: string;
  readonly method: "PUT";
  readonly headers: Record<string, string>;
  readonly expiresAt: number;
}

export async function requestUploadAction(
  rawInput: unknown,
): Promise<ActionResult<UploadGrantResponse>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const limiter = await rateLimit({
      key: `upload:${user.id}`,
      limit: LIMITERS.upload.limit,
      windowMs: LIMITERS.upload.windowMs,
    });
    if (!limiter.success) {
      return fail(
        "RATE_LIMITED",
        "You are uploading too quickly. Please wait a moment and try again.",
      );
    }

    const input = uploadRequestSchema.parse(rawInput);

    if (!isAllowedMimeType(input.mimeType)) {
      return fail(
        "UNSUPPORTED_MEDIA",
        `Files of type "${input.mimeType}" cannot be uploaded.`,
      );
    }

    // The plan decides how large a single file may be (100 MB on the free
    // tier, 2 GB on premium).
    const { effective } = await getUserPlan(user.id);
    if (input.size > effective.maxFileSizeBytes) {
      return fail(
        "VALIDATION_ERROR",
        `Files larger than ${Math.round(effective.maxFileSizeBytes / (1024 * 1024))} MB are not allowed on the ${effective.name} plan.`,
      );
    }

    const name = sanitizeName(input.fileName);
    const folderId = input.folderId ?? null;

    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, ownerId: user.id, isTrashed: false },
        select: { id: true },
      });
      if (!folder) return fail("NOT_FOUND", "Destination folder not found.");
    }

    const usage = await getStorageUsage(user.id);
    if (usage.quota > 0 && usage.used + input.size > usage.quota) {
      return fail(
        "QUOTA_EXCEEDED",
        "This upload would exceed your storage limit. Free up some space and try again.",
      );
    }

    const fileId = crypto.randomUUID();
    const storageKey = buildStorageKey(user.id, fileId);

    await prisma.file.create({
      data: {
        id: fileId,
        name,
        nameKey: toNameKey(name),
        mimeType: input.mimeType,
        size: BigInt(input.size),
        storageKey,
        ownerId: user.id,
        folderId,
        status: FileStatus.PENDING,
      },
    });

    const driver = getStorageDriver();
    const grant = await driver.createUploadGrant({
      key: storageKey,
      contentType: input.mimeType,
      maxSize: input.size,
    });

    return ok({
      fileId,
      url: grant.url,
      method: grant.method,
      headers: { ...grant.headers },
      expiresAt: grant.expiresAt,
    });
  } catch (error) {
    logServerError("requestUploadAction", error);
    if (error instanceof SanitizationError) {
      return fail("VALIDATION_ERROR", error.message);
    }
    return { ok: false, error: toActionError(error) };
  }
}

export async function completeUploadAction(
  rawInput: unknown,
): Promise<ActionResult<{ fileId: string; size: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = completeUploadSchema.parse(rawInput);

    const file = await prisma.file.findFirst({
      where: { id: input.fileId, ownerId: user.id },
      select: {
        id: true,
        status: true,
        size: true,
        storageKey: true,
      },
    });

    if (!file) return fail("NOT_FOUND", "Upload not found.");
    if (file.status === FileStatus.READY) {
      return ok({ fileId: file.id, size: Number(file.size) });
    }

    const driver = getStorageDriver();
    const stat = await driver.statObject(file.storageKey);

    if (!stat) {
      await prisma.file.update({
        where: { id: file.id },
        data: { status: FileStatus.FAILED },
      });
      return fail("STORAGE_ERROR", "The upload could not be verified.");
    }

    if (stat.size !== Number(file.size)) {
      await driver.deleteObject(file.storageKey).catch(() => undefined);
      await prisma.file.update({
        where: { id: file.id },
        data: { status: FileStatus.FAILED, size: BigInt(stat.size) },
      });
      return fail("STORAGE_ERROR", "The uploaded file is incomplete.");
    }

    const updated = await prisma.file.update({
      where: { id: file.id },
      data: { status: FileStatus.READY, size: BigInt(stat.size) },
      select: { id: true, size: true },
    });

    revalidatePath("/drive", "layout");
    revalidatePath("/recent", "layout");

    return ok({ fileId: updated.id, size: Number(updated.size) });
  } catch (error) {
    logServerError("completeUploadAction", error);
    return { ok: false, error: toActionError(error) };
  }
}

export async function abortUploadAction(
  rawInput: unknown,
): Promise<ActionResult<{ fileId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = abortUploadSchema.parse(rawInput);

    const file = await prisma.file.findFirst({
      where: { id: input.fileId, ownerId: user.id },
      select: { id: true, status: true, storageKey: true },
    });

    if (!file) return ok({ fileId: input.fileId });
    if (file.status === FileStatus.READY) {
      return fail("CONFLICT", "This file has already been uploaded.");
    }

    const driver = getStorageDriver();
    await driver.deleteObject(file.storageKey).catch(() => undefined);
    await prisma.file.delete({ where: { id: file.id } }).catch(() => undefined);

    return ok({ fileId: file.id });
  } catch (error) {
    logServerError("abortUploadAction", error);
    return { ok: false, error: toActionError(error) };
  }
}
