import "server-only";

import { prisma } from "@/lib/db/client";
import { getUserPlan } from "@/lib/db/queries/account";
import { deleteFileObjects } from "@/lib/storage/cleanup";

/**
 * Trash retention.
 *
 * Deleted items are not kept forever: after the retention period of the
 * plan (30 days on the free tier, 365 days on premium) they are removed
 * together with their objects.
 *
 * The purge runs when the trash is opened, which is enough for a
 * self-hosted drive and keeps the application free of background workers.
 */
export async function purgeExpiredTrash(ownerId: string): Promise<number> {
  const { effective } = await getUserPlan(ownerId);
  const retentionDays = effective.trashRetentionDays;

  if (retentionDays <= 0) return 0;

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const [expiredFiles, expiredFolders] = await Promise.all([
    prisma.file.findMany({
      where: { ownerId, isTrashed: true, trashedAt: { lt: cutoff } },
      select: {
        id: true,
        storageKey: true,
        versions: { select: { storageKey: true } },
      },
    }),
    prisma.folder.findMany({
      where: { ownerId, isTrashed: true, trashedAt: { lt: cutoff } },
      select: { id: true },
    }),
  ]);

  if (expiredFiles.length === 0 && expiredFolders.length === 0) return 0;

  // Folders can be nested, so the whole subtree has to be collected: the
  // bytes of a file in a sub folder would otherwise be orphaned in the
  // object store.
  const folderIds = await collectFolderSubtree(ownerId, expiredFolders.map((folder) => folder.id));

  const nestedFiles = folderIds.length
    ? await prisma.file.findMany({
        where: { ownerId, folderId: { in: folderIds }, isTrashed: true },
        select: {
          id: true,
          storageKey: true,
          versions: { select: { storageKey: true } },
        },
      })
    : [];

  const files = [...expiredFiles, ...nestedFiles].filter(
    (file, index, all) => all.findIndex((other) => other.id === file.id) === index,
  );

  await deleteFileObjects(files);

  if (files.length > 0) {
    await prisma.file.deleteMany({
      where: { id: { in: files.map((file) => file.id) } },
    });
  }

  if (folderIds.length > 0) {
    await prisma.folder.deleteMany({ where: { id: { in: folderIds } } });
  }

  return files.length + folderIds.length;
}

/**
 * Expands a list of folders to the whole subtree below them.
 * The tree is walked from the top, so every descendant is visited.
 */
async function collectFolderSubtree(
  ownerId: string,
  rootIds: readonly string[],
): Promise<string[]> {
  const collected = new Set(rootIds);
  let frontier = [...rootIds];

  while (frontier.length > 0) {
    const children = await prisma.folder.findMany({
      where: { ownerId, parentId: { in: frontier } },
      select: { id: true },
    });

    frontier = children
      .map((child) => child.id)
      .filter((id) => !collected.has(id));

    for (const id of frontier) collected.add(id);
  }

  return [...collected];
}
