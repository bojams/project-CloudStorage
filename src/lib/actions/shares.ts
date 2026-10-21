"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { logServerError, toActionError } from "@/lib/errors";
import { fail, ok, type ActionResult } from "@/lib/result";
import { shareCreateSchema, shareRevokeSchema } from "@/lib/validation/schemas";
import type { ShareSummary } from "@/types";

/**
 * Sharing.
 *
 * Links are protected by a 32-byte cryptographically random token — never a
 * sequential id — and every lookup is scoped to the owner of the item, so a
 * leaked link can only expose what the owner intended to share.
 */

function createShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createShareAction(
  rawInput: unknown,
): Promise<ActionResult<ShareSummary>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = shareCreateSchema.parse(rawInput);

    let recipientId: string | null = null;
    if (input.recipientEmail) {
      const recipient = await prisma.user.findUnique({
        where: { email: input.recipientEmail },
        select: { id: true, email: true },
      });
      if (!recipient) {
        return fail(
          "NOT_FOUND",
          "No account was found for that email address.",
        );
      }
      if (recipient.id === user.id) {
        return fail("VALIDATION_ERROR", "You cannot share an item with yourself.");
      }
      recipientId = recipient.id;
    }

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const token = createShareToken();

    if (input.target === "file") {
      const file = await prisma.file.findFirst({
        where: { id: input.targetId, ownerId: user.id },
        select: { id: true, name: true },
      });
      if (!file) return fail("NOT_FOUND", "File not found.");

      const share = await prisma.share.create({
        data: {
          token,
          fileId: file.id,
          ownerId: user.id,
          recipientId,
          permission: input.permission,
          expiresAt,
        },
        select: { id: true, token: true, createdAt: true, expiresAt: true },
      });

      revalidatePath("/shared", "layout");
      return ok(
        toSummary({
          share,
          targetType: "file",
          targetId: file.id,
          targetName: file.name,
          permission: input.permission,
          recipientEmail: input.recipientEmail,
        }),
      );
    }

    const folder = await prisma.folder.findFirst({
      where: { id: input.targetId, ownerId: user.id },
      select: { id: true, name: true },
    });
    if (!folder) return fail("NOT_FOUND", "Folder not found.");

    const share = await prisma.share.create({
      data: {
        token,
        folderId: folder.id,
        ownerId: user.id,
        recipientId,
        permission: input.permission,
        expiresAt,
      },
      select: { id: true, token: true, createdAt: true, expiresAt: true },
    });

    revalidatePath("/shared", "layout");
    return ok(
      toSummary({
        share,
        targetType: "folder",
        targetId: folder.id,
        targetName: folder.name,
        permission: input.permission,
        recipientEmail: input.recipientEmail,
      }),
    );
  } catch (error) {
    logServerError("createShareAction", error);
    return { ok: false, error: toActionError(error) };
  }
}

export async function revokeShareAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = shareRevokeSchema.parse(rawInput);

    const share = await prisma.share.findFirst({
      where: { id: input.shareId, ownerId: user.id },
      select: { id: true },
    });
    if (!share) return fail("NOT_FOUND", "Share not found.");

    await prisma.share.delete({ where: { id: share.id } });

    revalidatePath("/shared", "layout");
    return ok({ id: share.id });
  } catch (error) {
    logServerError("revokeShareAction", error);
    return { ok: false, error: toActionError(error) };
  }
}

interface ShareRecord {
  id: string;
  token: string;
  createdAt: Date;
  expiresAt: Date | null;
}

interface SummaryInput {
  readonly share: ShareRecord;
  readonly targetType: "file" | "folder";
  readonly targetId: string;
  readonly targetName: string;
  readonly permission: "VIEW" | "EDIT";
  readonly recipientEmail: string | null;
}

function toSummary({
  share,
  targetType,
  targetId,
  targetName,
  permission,
  recipientEmail,
}: SummaryInput): ShareSummary {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  return {
    id: share.id,
    token: share.token,
    targetId,
    targetType,
    targetName,
    permission,
    recipientEmail,
    expiresAt: share.expiresAt?.toISOString() ?? null,
    createdAt: share.createdAt.toISOString(),
    url: `${baseUrl}/share/${share.token}`,
  };
}
