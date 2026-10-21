import "server-only";

import { prisma } from "@/lib/db/client";

/**
 * Public share lookups.
 *
 * A share is only reachable through its 32-byte random token. Expiry and
 * revocation are enforced here so every public surface behaves the same.
 */

export interface PublicFileShare {
  readonly kind: "file";
  readonly name: string;
  readonly mimeType: string;
  readonly size: number;
  readonly token: string;
  readonly ownerName: string;
  readonly permission: "VIEW" | "EDIT";
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
}

export interface PublicFolderShare {
  readonly kind: "folder";
  readonly name: string;
  readonly token: string;
  readonly ownerName: string;
  readonly permission: "VIEW" | "EDIT";
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
  readonly items: readonly PublicFolderItem[];
}

export interface PublicFolderItem {
  readonly id: string;
  readonly name: string;
  readonly kind: "file" | "folder";
  readonly mimeType: string | null;
  readonly size: number;
}

export type PublicShare = PublicFileShare | PublicFolderShare;

function isExpired(expiresAt: Date | null): boolean {
  return expiresAt !== null && expiresAt.getTime() <= Date.now();
}

/**
 * Resolves a share token into a public, read-only payload.
 */
export async function getPublicShare(
  token: string,
): Promise<PublicShare | null> {
  if (!token || token.length < 20) return null;

  const share = await prisma.share.findUnique({
    where: { token },
    select: {
      token: true,
      permission: true,
      expiresAt: true,
      createdAt: true,
      file: {
        select: {
          id: true,
          name: true,
          mimeType: true,
          size: true,
          status: true,
          isTrashed: true,
          owner: { select: { name: true } },
        },
      },
      folder: {
        select: {
          id: true,
          name: true,
          isTrashed: true,
          owner: { select: { name: true } },
          files: {
            where: { isTrashed: false, status: "READY" },
            select: {
              id: true,
              name: true,
              mimeType: true,
              size: true,
            },
            orderBy: { name: "asc" },
            take: 200,
          },
          children: {
            where: { isTrashed: false },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
            take: 200,
          },
        },
      },
    },
  });

  if (!share) return null;
  if (isExpired(share.expiresAt)) return null;

  if (share.file) {
    if (share.file.isTrashed || share.file.status !== "READY") return null;

    return {
      kind: "file",
      name: share.file.name,
      mimeType: share.file.mimeType,
      size: Number(share.file.size),
      token: share.token,
      ownerName: share.file.owner.name,
      permission: share.permission,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
    };
  }

  if (share.folder) {
    if (share.folder.isTrashed) return null;

    const items: PublicFolderItem[] = [
      ...share.folder.children.map((child) => ({
        id: child.id,
        name: child.name,
        kind: "folder" as const,
        mimeType: null,
        size: 0,
      })),
      ...share.folder.files.map((file) => ({
        id: file.id,
        name: file.name,
        kind: "file" as const,
        mimeType: file.mimeType,
        size: Number(file.size),
      })),
    ].sort((a, b) => a.name.localeCompare(b.name));

    return {
      kind: "folder",
      name: share.folder.name,
      token: share.token,
      ownerName: share.folder.owner.name,
      permission: share.permission,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
      items,
    };
  }

  return null;
}

/**
 * Resolves the file behind a share token, used by the public download
 * endpoint.
 */
export async function getPublicSharedFile(token: string) {
  const share = await prisma.share.findUnique({
    where: { token },
    select: {
      permission: true,
      expiresAt: true,
      file: {
        select: {
          id: true,
          name: true,
          mimeType: true,
          storageKey: true,
          status: true,
          isTrashed: true,
        },
      },
    },
  });

  if (!share?.file) return null;
  if (isExpired(share.expiresAt)) return null;
  if (share.file.isTrashed || share.file.status !== "READY") return null;

  return share.file;
}
