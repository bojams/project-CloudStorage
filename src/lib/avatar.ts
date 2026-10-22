/**
 * Profile photo rules shared by the browser and the server.
 *
 * The module is intentionally free of any server-only import so the client
 * can validate a file *before* it is sent to the server. The server repeats
 * every check — the client side validation is a convenience, never a
 * security boundary.
 */

/** Profile photos are small; 4 MB is plenty for a square image. */
export const MAX_AVATAR_SIZE = 4 * 1024 * 1024;

/**
 * Only raster formats are accepted. SVG is scriptable and is therefore
 * rejected — the same rule that applies to regular uploads.
 */
export const AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const AVATAR_ACCEPT_ATTRIBUTE = AVATAR_MIME_TYPES.join(",");

export function isAllowedAvatarType(mimeType: string): boolean {
  return (AVATAR_MIME_TYPES as readonly string[]).includes(
    mimeType.split(";")[0]?.trim().toLowerCase() ?? "",
  );
}
