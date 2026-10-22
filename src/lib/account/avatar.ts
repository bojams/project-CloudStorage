import "server-only";

import { prisma } from "@/lib/db/client";
import { buildAvatarUrl } from "@/lib/db/queries/account";
import { buildAvatarStorageKey, getStorageDriver } from "@/lib/storage";

/**
 * Server side helpers for the profile photo.
 *
 * The photo is stored in the same object store as the regular files, but in
 * its own namespace (`a/<userId>/<avatarId>`) so it can never collide with
 * a user document and can be revoked independently.
 */

/** Stores a new photo and returns its public URL. */
export async function storeAvatar(
  userId: string,
  bytes: Buffer,
  mimeType: string,
): Promise<string> {
  const previous = await prisma.user.findUnique({
    where: { id: userId },
    select: { imageKey: true },
  });

  const key = buildAvatarStorageKey(userId, crypto.randomUUID());
  const driver = getStorageDriver();

  await driver.writeObject(key, bytes, mimeType);

  const now = new Date();
  const url = buildAvatarUrl(now);

  await prisma.user.update({
    where: { id: userId },
    data: {
      imageKey: key,
      imageMimeType: mimeType,
      imageUpdatedAt: now,
      image: url,
    },
  });

  // The old photo is removed only after the new one is stored and linked, so
  // a failure never leaves the account without a photo.
  if (previous?.imageKey && previous.imageKey !== key) {
    await driver.deleteObject(previous.imageKey).catch(() => undefined);
  }

  return url;
}

/** Removes the photo of an account (if any). */
export async function removeAvatar(userId: string): Promise<void> {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { imageKey: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      imageKey: null,
      imageMimeType: null,
      imageUpdatedAt: null,
      image: null,
    },
  });

  if (account?.imageKey) {
    const driver = getStorageDriver();
    await driver.deleteObject(account.imageKey).catch(() => undefined);
  }
}
