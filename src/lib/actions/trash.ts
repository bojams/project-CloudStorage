"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { logServerError, toActionError } from "@/lib/errors";
import { fail, ok, type ActionResult } from "@/lib/result";
import {
  deleteFileObjects,
  deleteFileWithObjects,
} from "@/lib/storage/cleanup";
import { deleteSchema, uuidSchema } from "@/lib/validation/schemas";
import type { ShareSummary } from "@/types";

/**
 * Trash operations: permanent deletion and share management.
 */

export async function permanentlyDeleteItemAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = deleteSchema.parse(rawInput);

    if (input.target === "folder") {
      const folder = await prisma.folder.findFirst({
        where: { id: input.id, ownerId: user.id },
        select: { id: true },
      });
      if (!folder) return fail("NOT_FOUND", "Folder not found.");

      const files = await prisma.file.findMany({
        where: { ownerId: user.id, folderId: folder.id },
        select: {
          id: true,
          storageKey: true,
          versions: { select: { storageKey: true } },
        },
      });

      await deleteFileObjects(files);

      await prisma.folder.delete({ where: { id: folder.id } }).catch(() => undefined);
    } else {
      const file = await prisma.file.findFirst({
        where: { id: input.id, ownerId: user.id },
        select: { id: true },
      });
      if (!file) return fail("NOT_FOUND", "File not found.");

      await deleteFileWithObjects(file.id);
    }

    revalidatePath("/drive", "layout");
    revalidatePath("/trash", "layout");
    return ok({ id: input.id });
  } catch (error) {
    logServerError("permanentlyDeleteItemAction", error);
    return { ok: false, error: toActionError(error) };
  }
}

export async function emptyTrashAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const files = await prisma.file.findMany({
      where: { ownerId: user.id, isTrashed: true },
      select: {
        id: true,
        storageKey: true,
        versions: { select: { storageKey: true } },
      },
    });

    const folders = await prisma.folder.findMany({
      where: { ownerId: user.id, isTrashed: true },
      select: { id: true },
    });

    await deleteFileObjects(files);

    await prisma.file.deleteMany({ where: { ownerId: user.id, isTrashed: true } });
    await prisma.folder.deleteMany({
      where: { ownerId: user.id, isTrashed: true },
    });

    revalidatePath("/drive", "layout");
    revalidatePath("/trash", "layout");
    return ok({ count: files.length + folders.length });
  } catch (error) {
    logServerError("emptyTrashAction", error);
    return { ok: false, error: toActionError(error) };
  }
}

export async function listSharesAction(
  rawInput: unknown,
): Promise<ActionResult<ShareSummary[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const targetId = uuidSchema.safeParse(rawInput);
    if (!targetId.success) {
      return fail("VALIDATION_ERROR", "Invalid identifier.");
    }

    const shares = await prisma.share.findMany({
      where: {
        ownerId: user.id,
        OR: [{ fileId: targetId.data }, { folderId: targetId.data }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        file: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true } },
        recipient: { select: { email: true } },
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const summaries: ShareSummary[] = shares.map((share) => {
      const targetName = share.file?.name ?? share.folder?.name ?? "Item";
      return {
        id: share.id,
        token: share.token,
        targetId: share.fileId ?? share.folderId ?? "",
        targetType: share.fileId ? "file" : "folder",
        targetName,
        permission: share.permission,
        recipientEmail: share.recipient?.email ?? null,
        expiresAt: share.expiresAt?.toISOString() ?? null,
        createdAt: share.createdAt.toISOString(),
        url: `${baseUrl}/share/${share.token}`,
      };
    });

    return ok(summaries);
  } catch (error) {
    logServerError("listSharesAction", error);
    return { ok: false, error: toActionError(error) };
  }
}
