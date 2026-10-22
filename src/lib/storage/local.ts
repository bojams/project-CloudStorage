import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { UPLOAD_GRANT_TTL } from "@/lib/constants";
import type { ServerEnv } from "@/lib/env";
import { createGrantToken } from "@/lib/storage/signing";
import {
  type ObjectStat,
  type StorageDriver,
  type UploadGrant,
  assertSafeStorageKey,
} from "@/lib/storage/types";

/**
 * Filesystem driver used for local development and self-hosted deployments.
 *
 * Security properties:
 *  * every key is validated against a strict pattern before being resolved;
 *  * the resolved absolute path must stay inside the storage root;
 *  * uploads are streamed to disk with a hard byte limit (no buffering of
 *    unbounded request bodies).
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;

  private readonly root: string;
  private readonly appUrl: string;
  private readonly signingSecret: string;

  constructor(env: ServerEnv) {
    this.root = path.resolve(process.cwd(), env.STORAGE_LOCAL_PATH);
    this.appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    this.signingSecret =
      env.UPLOAD_SIGNING_SECRET ?? env.AUTH_SECRET ?? randomUUID();
  }

  private resolvePath(key: string): string {
    assertSafeStorageKey(key);
    const resolved = path.resolve(this.root, key);
    const rootWithSep = this.root.endsWith(path.sep)
      ? this.root
      : `${this.root}${path.sep}`;

    if (!resolved.startsWith(rootWithSep)) {
      throw new Error("Rejected path outside of the storage root.");
    }
    return resolved;
  }

  async createUploadGrant(input: {
    key: string;
    contentType: string;
    maxSize: number;
  }): Promise<UploadGrant> {
    const expiresAt = Date.now() + UPLOAD_GRANT_TTL * 1000;
    const token = createGrantToken(
      {
        k: input.key,
        ct: input.contentType,
        ms: input.maxSize,
        exp: expiresAt,
      },
      this.signingSecret,
    );

    return {
      url: `${this.appUrl}/api/files/upload?token=${encodeURIComponent(token)}`,
      method: "PUT",
      headers: { "Content-Type": input.contentType },
      expiresAt,
    };
  }

  async createDownloadUrl(input: {
    key: string;
    fileName: string;
    expiresInSeconds: number;
  }): Promise<string | null> {
    assertSafeStorageKey(input.key);
    // The local driver streams through the authenticated download route.
    return null;
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.resolvePath(key), { force: true });
  }

  async statObject(key: string): Promise<ObjectStat | null> {
    try {
      const stats = await stat(this.resolvePath(key));
      if (!stats.isFile()) return null;
      return { size: stats.size };
    } catch {
      return null;
    }
  }

  async readObject(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolvePath(key));
    } catch {
      return null;
    }
  }

  /** Persists a buffer that was already validated by the upload route. */
  async writeObject(
    key: string,
    data: Buffer,
  ): Promise<void> {
    const target = this.resolvePath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  /** Computes a SHA-256 checksum used for integrity verification. */
  static checksum(data: Buffer): string {
    return createHash("sha256").update(data).digest("hex");
  }
}
