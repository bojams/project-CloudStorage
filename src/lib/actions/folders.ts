"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getFolderAncestors, getFolderTree } from "@/lib/db/queries/drive";
import { logServerError, toActionError } from "@/lib/errors";
import { fail, ok, type ActionResult } from "@/lib/result";
import { MAX_FOLDER_DEPTH } from "@/lib/constants";
import { SanitizationError, sanitizeName, toNameKey } from "@/lib/security/sanitize";
import {
  createFolderSchema,
  deleteSchema,
  moveSchema,
  renameSchema,
  restoreSchema,
} from "@/lib/validation/schemas";
import type { FolderNode } from "@/types";

/**
 * Folder & item management.
 *
 * Every action follows the same contract:
 *   1. authenticate,
 *   2. validate the payload with zod,
 *   3. sanitise user supplied strings,
 *   4. scope every database query by `ownerId` (no IDOR),
 *   5. return a typed `ActionResult` — never throw to the client.
 */

function revalidateDrive(): void {
  revalidatePath("/drive", "layout");
  revalidatePath("/shared", "layout");
  revalidatePath("/recent", "layout");
  revalidatePath("/trash", "layout");
}

async function assertFolderExists(
  ownerId: string,
  folderId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!folderId) return { ok: true };

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, ownerId, isTrashed: false },
    select: { id: true },
  });

  if (!folder) {
    return { ok: false, message: "The destination folder does not exist." };
  }
  return { ok: true };
}

/** Collects every descendant folder id (used for recursive soft deletes). */
async function collectDescendantFolderIds(
  ownerId: string,
  rootFolderId: string,
): Promise<string[]> {
  const collected: string[] = [];
  const visited = new Set<string>([rootFolderId]);
  let frontier: string[] = [rootFolderId];

  while (frontier.length > 0) {
    const children = await prisma.folder.findMany({
      where: { ownerId, parentId: { in: frontier } },
      select: { id: true },
    });

    const nextFrontier = children
      .map((child) => child.id)
      .filter((id) => !visited.has(id));

    for (const id of nextFrontier) visited.add(id);
    collected.push(...nextFrontier);
    frontier = nextFrontier;

    if (collected.length > 10_000) break;
  }

  return collected;
}

export async function createFolderAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = createFolderSchema.parse(rawInput);
    const name = sanitizeName(input.name);
    const parentId = input.parentId ?? null;

    const parentCheck = await assertFolderExists(user.id, parentId);
    if (!parentCheck.ok) return fail("NOT_FOUND", parentCheck.message);

    if (parentId) {
      const ancestors = await getFolderAncestors(user.id, parentId);
      if (ancestors.length >= MAX_FOLDER_DEPTH) {
        return fail(
          "VALIDATION_ERROR",
          `Folders cannot be nested more than ${MAX_FOLDER_DEPTH} levels deep.`,
        );
      }
    }

    const existing = await prisma.folder.findFirst({
      where: { ownerId: user.id, parentId, nameKey: toNameKey(name) },
      select: { id: true },
    });

    if (existing) {
      return fail("CONFLICT", "A folder with that name already exists here.");
    }

    const folder = await prisma.folder.create({
      data: { name, nameKey: toNameKey(name), ownerId: user.id, parentId },
      select: { id: true, name: true },
    });

    revalidateDrive();
    return ok(folder);
  } catch (error) {
    logServerError("createFolderAction", error);
    if (error instanceof SanitizationError) {
      return fail("VALIDATION_ERROR", error.message);
    }
    if (error instanceof z.ZodError) {
      return { ok: false, error: toActionError(error) };
    }
    return { ok: false, error: toActionError(error) };
  }
}

export async function renameItemAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = renameSchema.parse(rawInput);
    const name = sanitizeName(input.name);
    const nameKey = toNameKey(name);

    if (input.target === "folder") {
      const folder = await prisma.folder.findFirst({
        where: { id: input.id, ownerId: user.id },
        select: { id: true, parentId: true, nameKey: true },
      });
      if (!folder) return fail("NOT_FOUND", "Folder not found.");
      if (folder.nameKey === nameKey) return ok({ id: folder.id, name });

      const duplicate = await prisma.folder.findFirst({
        where: {
          ownerId: user.id,
          parentId: folder.parentId,
          nameKey,
          id: { not: folder.id },
        },
        select: { id: true },
      });
      if (duplicate) {
        return fail("CONFLICT", "A folder with that name already exists here.");
      }

      const updated = await prisma.folder.update({
        where: { id: folder.id },
        data: { name, nameKey },
        select: { id: true, name: true },
      });

      revalidateDrive();
      return ok(updated);
    }

    const file = await prisma.file.findFirst({
      where: { id: input.id, ownerId: user.id },
      select: { id: true, folderId: true, nameKey: true },
    });
    if (!file) return fail("NOT_FOUND", "File not found.");
    if (file.nameKey === nameKey) return ok({ id: file.id, name });

    const updated = await prisma.file.update({
      where: { id: file.id },
      data: { name, nameKey },
      select: { id: true, name: true },
    });

    revalidateDrive();
    return ok(updated);
  } catch (error) {
    logServerError("renameItemAction", error);
    if (error instanceof SanitizationError) {
      return fail("VALIDATION_ERROR", error.message);
    }
    return { ok: false, error: toActionError(error) };
  }
}

export async function moveItemAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = moveSchema.parse(rawInput);
    const destinationId = input.destinationFolderId;

    const destinationCheck = await assertFolderExists(user.id, destinationId);
    if (!destinationCheck.ok) return fail("NOT_FOUND", destinationCheck.message);

    if (input.target === "folder") {
      const folder = await prisma.folder.findFirst({
        where: { id: input.id, ownerId: user.id },
        select: { id: true, parentId: true },
      });
      if (!folder) return fail("NOT_FOUND", "Folder not found.");

      if (destinationId === folder.id) {
        return fail("VALIDATION_ERROR", "A folder cannot be moved into itself.");
      }

      if (destinationId) {
        const ancestors = await getFolderAncestors(user.id, destinationId);
        if (ancestors.some((ancestor) => ancestor.id === folder.id)) {
          return fail(
            "VALIDATION_ERROR",
            "A folder cannot be moved into one of its own subfolders.",
          );
        }
      }

      await prisma.folder.update({
        where: { id: folder.id },
        data: { parentId: destinationId },
      });
    } else {
      const file = await prisma.file.findFirst({
        where: { id: input.id, ownerId: user.id },
        select: { id: true },
      });
      if (!file) return fail("NOT_FOUND", "File not found.");

      await prisma.file.update({
        where: { id: file.id },
        data: { folderId: destinationId },
      });
    }

    revalidateDrive();
    return ok({ id: input.id });
  } catch (error) {
    logServerError("moveItemAction", error);
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteItemAction(
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

      const descendantIds = await collectDescendantFolderIds(user.id, folder.id);
      const now = new Date();

      await prisma.$transaction([
        prisma.folder.updateMany({
          where: { ownerId: user.id, id: { in: descendantIds } },
          data: { isTrashed: true, trashedAt: now },
        }),
        prisma.file.updateMany({
          where: {
            ownerId: user.id,
            folderId: { in: [folder.id, ...descendantIds] },
            isTrashed: false,
          },
          data: { isTrashed: true, trashedAt: now },
        }),
        prisma.folder.update({
          where: { id: folder.id },
          data: { isTrashed: true, trashedAt: now },
        }),
      ]);
    } else {
      const file = await prisma.file.findFirst({
        where: { id: input.id, ownerId: user.id },
        select: { id: true },
      });
      if (!file) return fail("NOT_FOUND", "File not found.");

      await prisma.file.update({
        where: { id: file.id },
        data: { isTrashed: true, trashedAt: new Date() },
      });
    }

    revalidateDrive();
    return ok({ id: input.id });
  } catch (error) {
    logServerError("deleteItemAction", error);
    return { ok: false, error: toActionError(error) };
  }
}

export async function restoreItemAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = restoreSchema.parse(rawInput);

    if (input.target === "folder") {
      const folder = await prisma.folder.findFirst({
        where: { id: input.id, ownerId: user.id },
        select: { id: true },
      });
      if (!folder) return fail("NOT_FOUND", "Folder not found.");

      const descendantIds = await collectDescendantFolderIds(user.id, folder.id);

      await prisma.$transaction([
        prisma.folder.updateMany({
          where: { ownerId: user.id, id: { in: descendantIds } },
          data: { isTrashed: false, trashedAt: null },
        }),
        prisma.file.updateMany({
          where: {
            ownerId: user.id,
            folderId: { in: [folder.id, ...descendantIds] },
            isTrashed: true,
          },
          data: { isTrashed: false, trashedAt: null },
        }),
        prisma.folder.update({
          where: { id: folder.id },
          data: { isTrashed: false, trashedAt: null },
        }),
      ]);
    } else {
      const file = await prisma.file.findFirst({
        where: { id: input.id, ownerId: user.id },
        select: { id: true },
      });
      if (!file) return fail("NOT_FOUND", "File not found.");

      await prisma.file.update({
        where: { id: file.id },
        data: { isTrashed: false, trashedAt: null },
      });
    }

    revalidateDrive();
    return ok({ id: input.id });
  } catch (error) {
    logServerError("restoreItemAction", error);
    return { ok: false, error: toActionError(error) };
  }
}

/** Returns the folder tree used by the "Move" dialog. */
export async function listFolderTreeAction(): Promise<
  ActionResult<FolderNode[]>
> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const tree = await getFolderTree(user.id);
    return ok(tree);
  } catch (error) {
    logServerError("listFolderTreeAction", error);
    return { ok: false, error: toActionError(error) };
  }
}
