import { describe, expect, it } from "vitest";

import { defaultMessage, fail, ok, okEmpty } from "@/lib/result";

describe("ok", () => {
  it("wraps the payload", () => {
    expect(ok({ id: "1" })).toEqual({ ok: true, data: { id: "1" } });
  });
});

describe("okEmpty", () => {
  it("returns an empty success envelope", () => {
    expect(okEmpty()).toEqual({ ok: true, data: undefined });
  });
});

describe("fail", () => {
  it("falls back to the default message of the code", () => {
    const result = fail("NOT_FOUND");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toBe(defaultMessage("NOT_FOUND"));
    }
  });

  it("keeps a custom message", () => {
    const result = fail("VALIDATION_ERROR", "Name is required.");
    if (!result.ok) expect(result.error.message).toBe("Name is required.");
  });

  it("attaches field errors when provided", () => {
    const result = fail("VALIDATION_ERROR", undefined, {
      name: ["Name is required."],
    });
    if (!result.ok) {
      expect(result.error.fieldErrors?.name).toEqual(["Name is required."]);
    }
  });

  it("omits the field errors when they are not provided", () => {
    const result = fail("INTERNAL_ERROR");
    if (!result.ok) expect(result.error.fieldErrors).toBeUndefined();
  });
});

describe("defaultMessage", () => {
  it("returns a message for every error code", () => {
    const codes = [
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "VALIDATION_ERROR",
      "CONFLICT",
      "RATE_LIMITED",
      "QUOTA_EXCEEDED",
      "UNSUPPORTED_MEDIA",
      "STORAGE_ERROR",
      "INTERNAL_ERROR",
    ] as const;

    for (const code of codes) {
      expect(defaultMessage(code).length).toBeGreaterThan(0);
    }
  });
});
