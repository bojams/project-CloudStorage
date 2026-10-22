import { describe, expect, it } from "vitest";

import {
  createGrantToken,
  verifyGrantToken,
} from "@/lib/storage/signing";

const SECRET = "unit-test-signing-secret-value";
const payload = {
  k: "u/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222",
  ct: "text/plain",
  ms: 1024,
  exp: 1_800_000_000_000,
};

describe("createGrantToken / verifyGrantToken", () => {
  it("round-trips a valid grant", () => {
    const token = createGrantToken(payload, SECRET);
    const result = verifyGrantToken(token, SECRET);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.k).toBe(payload.k);
      expect(result.payload.ct).toBe("text/plain");
      expect(result.payload.ms).toBe(1024);
    }
  });

  it("rejects a token signed with a different secret", () => {
    const token = createGrantToken(payload, SECRET);
    const result = verifyGrantToken(token, "another-secret-value-here");

    expect(result).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects a tampered payload", () => {
    const token = createGrantToken(payload, SECRET);
    const [body, signature] = token.split(".");
    const tampered = `${body}x.${signature}`;

    expect(verifyGrantToken(tampered, SECRET)).toEqual({
      ok: false,
      reason: "signature",
    });
  });

  it("rejects a malformed token", () => {
    expect(verifyGrantToken("not-a-token", SECRET)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects an expired grant", () => {
    const token = createGrantToken({ ...payload, exp: 1_000 }, SECRET);
    const result = verifyGrantToken(token, SECRET, 2_000);

    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("accepts a grant that is still valid", () => {
    const token = createGrantToken({ ...payload, exp: 2_000 }, SECRET);
    expect(verifyGrantToken(token, SECRET, 1_000).ok).toBe(true);
  });
});
