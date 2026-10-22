import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("wrong horse battery", hash)).toBe(false);
  });

  it("produces a salted hash", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");
    expect(first).not.toBe(second);
  });

  it("never stores the plain text", async () => {
    const hash = await hashPassword("plaintext-secret");
    expect(hash).not.toContain("plaintext-secret");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("returns false for a malformed hash instead of throwing", async () => {
    expect(await verifyPassword("anything", "not-a-bcrypt-hash")).toBe(false);
  });
});
