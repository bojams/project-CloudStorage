import { describe, expect, it } from "vitest";

import {
  AVATAR_MIME_TYPES,
  isAllowedAvatarType,
  MAX_AVATAR_SIZE,
} from "@/lib/avatar";

describe("avatar rules", () => {
  it("accepts the raster formats only", () => {
    for (const mimeType of AVATAR_MIME_TYPES) {
      expect(isAllowedAvatarType(mimeType)).toBe(true);
    }
  });

  it("rejects scriptable formats", () => {
    expect(isAllowedAvatarType("image/svg+xml")).toBe(false);
    expect(isAllowedAvatarType("text/html")).toBe(false);
    expect(isAllowedAvatarType("application/pdf")).toBe(false);
  });

  it("ignores the charset parameter", () => {
    expect(isAllowedAvatarType("image/png; charset=binary")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isAllowedAvatarType("IMAGE/JPEG")).toBe(true);
  });

  it("limits the size to 4 MB", () => {
    expect(MAX_AVATAR_SIZE).toBe(4 * 1024 * 1024);
  });
});
