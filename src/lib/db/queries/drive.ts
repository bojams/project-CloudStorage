import "server-only";

import { FileStatus } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { toDriveItem } from "@/lib/db/mappers";
import type { DriveItem, FolderNode } from "@/types";

/**
 * Read model for the drive.
 *
 * Every query is scoped by `ownerId`, which is the first line of defence
 * against IDOR (Insecure Direct Object Reference). All queries are executed
 * through Prisma, i.e. with bound parameters — no SQL string concatenation
 * exists anywhere in this codebase.
 */

export interface FolderContents {
  readonly folders: DriveItem[];
  readonly files: DriveItem[];
}

export async function listFolderContents(
  ownerId: string,
  folderId: string | null,
): Promise<FolderContents> {
  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: { ownerId, parentId: folderId, isTrashed: false },
      orderBy: { name: "asc" },
      include: { _count: { select: { shares: true } } },
    }),
    prisma.file.findMany({
      where: {
        ownerId,
        folderId,
        isTrashed: false,
        status: FileStatus.READY,
      },
      orderBy: { name: "asc" },
      include: { _count: { select: { shares: true } } },
    }),
  ]);

  return {
    folders: folders.map((folder) => toDriveItem(folder, "folder")),
    files: files.map((file) => toDriveItem(file, "file")),
  };
}

/**
 * Lists the children of a folder *without* an owner filter.
 * Used when a folder was shared with the viewer: the access check happens
 * before the listing, the children still belong to the original owner.
 */
export async function listSharedFolderContents(
  folderId: string,
  options: { canModify?: boolean } = {},
): Promise<FolderContents> {
  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: { parentId: folderId, isTrashed: false },
      orderBy: { name: "asc" },
      include: { _count: { select: { shares: true } } },
    }),
    prisma.file.findMany({
      where: { folderId, isTrashed: false, status: FileStatus.READY },
      orderBy: { name: "asc" },
      include: { _count: { select: { shares: true } } },
    }),
  ]);

  return {
    folders: folders.map((folder) =>
      toDriveItem(folder, "folder", { canModify: options.canModify ?? false }),
    ),
    files: files.map((file) =>
      toDriveItem(file, "file", { canModify: options.canModify ?? false }),
    ),
  };
}

export interface FolderAccess {
  readonly canView: boolean;
  readonly canEdit: boolean;
  readonly isOwner: boolean;
  readonly ownerId: string;
}

/**
 * Resolves the access level of a user for a folder.
 *
 * A user may access a folder when they own it, or when a share (direct or
 * inherited from an ancestor) grants access to them.
 */
export async function getFolderAccess(
  userId: string,
  folderId: string,
): Promise<FolderAccess | null> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { id: true, ownerId: true, isTrashed: true },
  });

  if (!folder || folder.isTrashed) return null;

  if (folder.ownerId === userId) {
    return { canView: true, canEdit: true, isOwner: true, ownerId: folder.ownerId };
  }

  const ancestors = await getFolderAncestors(folder.ownerId, folderId);
  const ancestorIds = ancestors.map((ancestor) => ancestor.id);

  const share = await prisma.share.findFirst({
    where: {
      folderId: { in: ancestorIds },
      permission: { in: ["VIEW", "EDIT"] },
      OR: [{ recipientId: userId }, { recipientId: null }],
      AND: [
        {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      ],
    },
    select: { permission: true },
  });

  if (!share) return null;

  return {
    canView: true,
    canEdit: share.permission === "EDIT",
    isOwner: false,
    ownerId: folder.ownerId,
  };
}

export async function getFolderRecord(ownerId: string, folderId: string) {
  return prisma.folder.findFirst({
    where: { id: folderId, ownerId },
    include: { _count: { select: { shares: true } } },
  });
}

export async function listRecentFiles(
  ownerId: string,
  limit = 40,
): Promise<DriveItem[]> {
  const files = await prisma.file.findMany({
    where: { ownerId, isTrashed: false, status: FileStatus.READY },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: { _count: { select: { shares: true } } },
  });

  return files.map((file) => toDriveItem(file, "file"));
}

export async function listTrash(ownerId: string): Promise<DriveItem[]> {
  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: { ownerId, isTrashed: true },
      orderBy: { trashedAt: "desc" },
      include: { _count: { select: { shares: true } } },
    }),
    prisma.file.findMany({
      where: { ownerId, isTrashed: true },
      orderBy: { trashedAt: "desc" },
      include: { _count: { select: { shares: true } } },
    }),
  ]);

  return [
    ...folders.map((folder) => toDriveItem(folder, "folder")),
    ...files.map((file) => toDriveItem(file, "file")),
  ].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function getStorageUsage(ownerId: string) {
  // The aggregate already returns the number of matching rows, so a second
  // `count` query would only add latency to every navigation.
  const [aggregate, user] = await Promise.all([
    prisma.file.aggregate({
      where: { ownerId, isTrashed: false, status: FileStatus.READY },
      _sum: { size: true },
      _count: { _all: true },
    }),
    prisma.user.findUnique({
      where: { id: ownerId },
      select: { storageQuota: true },
    }),
  ]);

  return {
    used: Number(aggregate._sum.size ?? 0),
    quota: Number(user?.storageQuota ?? 0),
    fileCount: aggregate._count._all,
  };
}

export async function getFolderTree(ownerId: string): Promise<FolderNode[]> {
  const folders = await prisma.folder.findMany({
    where: { ownerId, isTrashed: false },
    select: { id: true, name: true, parentId: true },
    orderBy: { name: "asc" },
  });

  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
  }));
}

/**
 * Returns the ancestor chain of a folder, root first.
 * The query walks upwards with a bounded number of iterations, which prevents
 * an infinite loop even if the data were corrupted.
 */
export async function getFolderAncestors(
  ownerId: string,
  folderId: string | null,
): Promise<{ id: string; name: string }[]> {
  const chain: { id: string; name: string }[] = [];
  const visited = new Set<string>();

  let currentId = folderId;

  while (currentId && !visited.has(currentId) && chain.length < 32) {
    visited.add(currentId);

    const folder = await prisma.folder.findFirst({
      where: { id: currentId, ownerId },
      select: { id: true, name: true, parentId: true },
    });
    if (!folder) break;

    chain.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parentId;
  }

  return chain;
}

/** Depth of a folder relative to the drive root (root = 0). */
export async function getFolderDepth(
  ownerId: string,
  folderId: string | null,
): Promise<number> {
  const ancestors = await getFolderAncestors(ownerId, folderId);
  return ancestors.length;
}

export async function listSharedWithMe(userId: string): Promise<DriveItem[]> {
  const shares = await prisma.share.findMany({
    where: {
      recipientId: userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      file: { include: { _count: { select: { shares: true } } } },
      folder: { include: { _count: { select: { shares: true } } } },
    },
  });

  return shares.flatMap((share) => {
    if (share.file) {
      const item = toDriveItem(share.file, "file", { canModify: false });
      return [{ ...item, isShared: true, sharedByMe: true }];
    }
    if (share.folder) {
      const item = toDriveItem(share.folder, "folder", { canModify: false });
      return [{ ...item, isShared: true, sharedByMe: true }];
    }
    return [];
  });
}

export async function listSharesByOwner(ownerId: string) {
  const shares = await prisma.share.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: {
      file: { select: { id: true, name: true } },
      folder: { select: { id: true, name: true } },
      recipient: { select: { id: true, name: true, email: true } },
    },
  });

  return shares;
}
