import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { ServerEnv } from "@/lib/env";
import {
  type ObjectStat,
  type StorageDriver,
  type UploadGrant,
  assertSafeStorageKey,
} from "@/lib/storage/types";

/**
 * Amazon S3 (or any S3 compatible endpoint such as R2, MinIO, DigitalOcean
 * Spaces) driver.
 *
 * Uploads go straight from the browser to S3 using a presigned PUT URL, so
 * application servers never proxy file bytes — this removes a whole class of
 * denial-of-service issues and keeps the compute bill low.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = "s3" as const;

  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(env: ServerEnv) {
    if (!env.AWS_S3_BUCKET) {
      throw new Error("AWS_S3_BUCKET is required when STORAGE_DRIVER=s3.");
    }

    this.bucket = env.AWS_S3_BUCKET;
    this.client = new S3Client({
      region: env.AWS_REGION,
      endpoint: env.AWS_S3_ENDPOINT,
      forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
      credentials:
        env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  async createUploadGrant(input: {
    key: string;
    contentType: string;
    maxSize: number;
  }): Promise<UploadGrant> {
    assertSafeStorageKey(input.key);

    const expiresIn = 15 * 60;
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.maxSize,
        ServerSideEncryption: "AES256",
      }),
      { expiresIn },
    );

    return {
      url,
      method: "PUT",
      headers: {
        "Content-Type": input.contentType,
        "x-amz-server-side-encryption": "AES256",
      },
      expiresAt: Date.now() + expiresIn * 1000,
    };
  }

  async createDownloadUrl(input: {
    key: string;
    fileName: string;
    expiresInSeconds: number;
  }): Promise<string | null> {
    assertSafeStorageKey(input.key);

    const safeName = input.fileName.replace(/[\r\n"\\]/g, "_");

    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ResponseContentDisposition: `attachment; filename="${safeName}"`,
      }),
      { expiresIn: input.expiresInSeconds },
    );
  }

  async deleteObject(key: string): Promise<void> {
    assertSafeStorageKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async statObject(key: string): Promise<ObjectStat | null> {
    assertSafeStorageKey(key);

    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { size: result.ContentLength ?? 0 };
    } catch {
      return null;
    }
  }

  async readObject(key: string): Promise<Buffer | null> {
    assertSafeStorageKey(key);

    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch {
      return null;
    }
  }

  async writeObject(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<void> {
    assertSafeStorageKey(key);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
      }),
    );
  }
}
