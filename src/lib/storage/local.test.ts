import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ServerEnv } from "@/lib/env";
import { LocalStorageDriver } from "@/lib/storage/local";
import { StorageError, buildStorageKey } from "@/lib/storage/types";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const FILE_ID = "22222222-2222-4222-8222-222222222222";
const KEY = buildStorageKey(USER_ID, FILE_ID);

let root: string;
let driver: LocalStorageDriver;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "nimbus-storage-"));

  const env = {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://user:password@localhost:5432/nimbus_test",
    AUTH_SECRET: "a".repeat(32),
    AUTH_TRUST_HOST: true,
    STORAGE_DRIVER: "local",
    STORAGE_LOCAL_PATH: root,
    AWS_REGION: "us-east-1",
    AWS_S3_FORCE_PATH_STYLE: false,
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_NAME: "Nimbus Drive",
  } satisfies ServerEnv;

  driver = new LocalStorageDriver(env);
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("LocalStorageDriver", () => {
  it("is identified as the local driver", () => {
    expect(driver.name).toBe("local");
  });

  it("creates a signed upload grant pointing at the upload route", async () => {
    const grant = await driver.createUploadGrant({
      key: KEY,
      contentType: "text/plain",
      maxSize: 1024,
    });

    expect(grant.method).toBe("PUT");
    expect(grant.headers["Content-Type"]).toBe("text/plain");
    expect(grant.url.startsWith("http://localhost:3000/api/files/upload?token=")).toBe(
      true,
    );
    expect(grant.expiresAt).toBeGreaterThan(Date.now());
  });

  it("round-trips an object", async () => {
    const payload = Buffer.from("hello nimbus", "utf8");
    await driver.writeObject(KEY, payload);

    const read = await driver.readObject(KEY);
    expect(read?.toString("utf8")).toBe("hello nimbus");

    const stat = await driver.statObject(KEY);
    expect(stat?.size).toBe(payload.byteLength);
  });

  it("returns null for a missing object", async () => {
    const missing = buildStorageKey(
      USER_ID,
      "33333333-3333-4333-8333-333333333333",
    );
    expect(await driver.readObject(missing)).toBeNull();
    expect(await driver.statObject(missing)).toBeNull();
  });

  it("deletes an object without failing on a missing key", async () => {
    await driver.writeObject(KEY, Buffer.from("temporary", "utf8"));
    await driver.deleteObject(KEY);

    expect(await driver.statObject(KEY)).toBeNull();
    await expect(driver.deleteObject(KEY)).resolves.toBeUndefined();
  });

  it("refuses to write outside of the storage root", async () => {
    await expect(
      driver.writeObject("../../escape.txt", Buffer.from("nope", "utf8")),
    ).rejects.toThrow(StorageError);
  });

  it("does not support presigned download URLs", async () => {
    expect(await driver.createDownloadUrl({ key: KEY, fileName: "a.txt", expiresInSeconds: 60 })).toBeNull();
  });

  it("computes a stable checksum", () => {
    const checksum = LocalStorageDriver.checksum(Buffer.from("nimbus", "utf8"));
    expect(checksum).toBe(
      LocalStorageDriver.checksum(Buffer.from("nimbus", "utf8")),
    );
    expect(checksum).toHaveLength(64);
  });
});
