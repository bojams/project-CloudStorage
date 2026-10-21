import "server-only";

import { getEnv, type ServerEnv } from "@/lib/env";
import { LocalStorageDriver } from "@/lib/storage/local";
import { S3StorageDriver } from "@/lib/storage/s3";
import type { StorageDriver } from "@/lib/storage/types";

let cachedDriver: StorageDriver | null = null;

export function createStorageDriver(env: ServerEnv): StorageDriver {
  return env.STORAGE_DRIVER === "s3"
    ? new S3StorageDriver(env)
    : new LocalStorageDriver(env);
}

/** Returns the process-wide storage driver. */
export function getStorageDriver(): StorageDriver {
  if (cachedDriver) return cachedDriver;
  cachedDriver = createStorageDriver(getEnv());
  return cachedDriver;
}

/** The local driver exposes extra helpers used by the upload route. */
export function getLocalStorageDriver(): LocalStorageDriver {
  const driver = getStorageDriver();
  if (!(driver instanceof LocalStorageDriver)) {
    throw new Error("The local storage driver is not active.");
  }
  return driver;
}

export * from "@/lib/storage/types";
