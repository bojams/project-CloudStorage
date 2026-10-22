import { describe, expect, it } from "vitest";

import {
  StorageError,
  assertSafeStorageKey,
  buildStorageKey,
} from "@/lib/storage/types";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const FILE_ID = "22222222-2222-4222-8222-222222222222";

describe("buildStorageKey", () => {
  it("builds an opaque, namespaced key", () => {
    expect(buildStorageKey(USER_ID, FILE_ID)).toBe(`u/${USER_ID}/${FILE_ID}`);
  });

  it("never embeds the file name", () => {
    const key = buildStorageKey(USER_ID, FILE_ID);
    expect(key).not.toContain(".");
    expect(key.split("/")).toHaveLength(3);
  });
});

describe("assertSafeStorageKey", () => {
  it("accepts a generated key", () => {
    const key = buildStorageKey(USER_ID, FILE_ID);
    expect(assertSafeStorageKey(key)).toBe(key);
  });

  it("rejects path traversal", () => {
    expect(() => assertSafeStorageKey("../../etc/passwd")).toThrow(StorageError);
  });

  it("rejects absolute paths", () => {
    expect(() => assertSafeStorageKey("/etc/passwd")).toThrow(StorageError);
  });

  it("rejects keys with a user supplied file name", () => {
    expect(() =>
      assertSafeStorageKey(`u/${USER_ID}/secret.txt`),
    ).toThrow(StorageError);
  });

  it("rejects keys outside of the u/ namespace", () => {
    expect(() => assertSafeStorageKey(`${USER_ID}/${FILE_ID}`)).toThrow(
      StorageError,
    );
  });

  it("rejects an empty key", () => {
    expect(() => assertSafeStorageKey("")).toThrow(StorageError);
  });
});
