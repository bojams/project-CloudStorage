import "server-only";

import type { File, Folder } from "@prisma/client";

import type { DriveItem, ItemType } from "@/types";

/**
 * Mappers translate Prisma rows into the serialisable shapes consumed by the
 * UI. This is the single place where `BigInt` columns are converted to
 * `number`, which keeps the React Server Component payload JSON safe.
 */

export type FileWithRelations = File & {
  folder?: Pick<Folder, "id" | "name"> | null;
  _count?: { shares: number };
};

export type FolderWithRelations = Folder & {
  parent?: Pick<Folder, "id" | "name"> | null;
  _count?: { shares: number };
};

export function toDriveItem(
  item: FileWithRelations | FolderWithRelations,
  type: ItemType,
  options: { canModify?: boolean } = {},
): DriveItem {
  const isFile = type === "file";
  const file = isFile ? (item as FileWithRelations) : null;
  const folder = isFile ? null : (item as FolderWithRelations);

  return {
    id: item.id,
    type,
    name: item.name,
    mimeType: isFile ? (file?.mimeType ?? null) : null,
    size: isFile ? Number(file?.size ?? 0) : 0,
    folderId: isFile ? (file?.folderId ?? null) : item.id,
    parentId: isFile ? null : (folder?.parentId ?? null),
    ownerId: item.ownerId,
    isTrashed: item.isTrashed,
    isShared: (item._count?.shares ?? 0) > 0,
    sharedByMe: false,
    canModify: options.canModify ?? true,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
