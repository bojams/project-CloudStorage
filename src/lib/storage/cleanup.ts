import "server-only";

import { prisma } from "@/lib/db/client";
import { getStorageDriver } from "@/lib/storage";

/**
 * Helpers that remove rows *and* the objects that belong to them.
 *
 * Deleting a database row alone would leave the bytes in the object store
 * forever — the storage bill keeps growing and the user can never reclaim
 * the space.
 */

interface FileWithObjects {
  readonly id: string;
  readonly storageKey: string;
  readonly versions: readonly { readonly storageKey: string }[];
}

/** Removes the objects of a file (current bytes and every revision). */
export async function deleteFileObjects(
  files: readonly FileWithObjects[],
): Promise<void> {
  if (files.length === 0) return;

  const driver = getStorageDriver();

  const keys = files.flatMap((file) => [
    file.storageKey,
    ...file.versions.map((version) => version.storageKey),
  ]);

  await Promise.all(
    keys.map((key) => driver.deleteObject(key).catch(() => undefined)),
  );
}

/** Deletes a single file row together with its objects. */
export async function deleteFileWithObjects(fileId: string): Promise<void> {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      storageKey: true,
      versions: { select: { storageKey: true } },
    },
  });

  if (!file) return;

  await deleteFileObjects([file]);
  await prisma.file.delete({ where: { id: fileId } }).catch(() => undefined);
}
