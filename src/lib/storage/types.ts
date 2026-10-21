import "server-only";

/**
 * Storage abstraction.
 *
 * The rest of the application never talks to S3 or the filesystem directly;
 * it only knows about opaque *storage keys*. Because keys are generated
 * server-side (`u/<userId>/<fileId>`) they can never contain a user supplied
 * path, which eliminates directory traversal by design.
 */

export type StorageDriverName = "local" | "s3";

export interface UploadGrant {
  /** Absolute URL the client PUTs the bytes to. */
  readonly url: string;
  readonly method: "PUT";
  readonly headers: Readonly<Record<string, string>>;
  /** Epoch ms after which the grant is no longer valid. */
  readonly expiresAt: number;
}

export interface ObjectStat {
  readonly size: number;
}

export interface StorageDriver {
  readonly name: StorageDriverName;

  /** Creates a short-lived, single-purpose upload grant. */
  createUploadGrant(input: {
    key: string;
    contentType: string;
    maxSize: number;
  }): Promise<UploadGrant>;

  /** Creates a time-limited download URL (S3) or `null` when unsupported. */
  createDownloadUrl(input: {
    key: string;
    fileName: string;
    expiresInSeconds: number;
  }): Promise<string | null>;

  /** Removes the object; must never throw for a missing key. */
  deleteObject(key: string): Promise<void>;

  /** Returns object metadata, or `null` when the object does not exist. */
  statObject(key: string): Promise<ObjectStat | null>;

  /** Reads the whole object into memory (used by the local download proxy). */
  readObject(key: string): Promise<Buffer | null>;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

const STORAGE_KEY_PATTERN =
  /^u\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Builds an opaque storage key. Never derived from user input. */
export function buildStorageKey(userId: string, fileId: string): string {
  return `u/${userId}/${fileId}`;
}

/**
 * Hard guarantee that a storage key cannot escape its namespace.
 * Every key is validated before it reaches the filesystem or the S3 client.
 */
export function assertSafeStorageKey(key: string): string {
  if (!STORAGE_KEY_PATTERN.test(key)) {
    throw new StorageError("Rejected unsafe storage key.");
  }
  return key;
}
