import { describe, expect, it } from "vitest";

import {
  getExtensionForMime,
  getFileCategory,
  getMimeLabel,
  inferMimeTypeFromName,
  isAllowedMimeType,
  isInlineSafeMimeType,
  listAllowedMimeTypes,
  normalizeMimeType,
} from "@/lib/security/mime";

describe("normalizeMimeType", () => {
  it("strips parameters and lowercases the value", () => {
    expect(normalizeMimeType("TEXT/PLAIN; charset=utf-8")).toBe("text/plain");
  });
});

describe("isAllowedMimeType", () => {
  it("accepts common safe types", () => {
    expect(isAllowedMimeType("image/png")).toBe(true);
    expect(isAllowedMimeType("application/pdf")).toBe(true);
    expect(isAllowedMimeType("text/plain")).toBe(true);
  });

  it("rejects executable and script types", () => {
    expect(isAllowedMimeType("application/x-msdownload")).toBe(false);
    expect(isAllowedMimeType("application/x-sh")).toBe(false);
    expect(isAllowedMimeType("text/html")).toBe(false);
  });

  it("rejects SVG because it can carry scripts", () => {
    expect(isAllowedMimeType("image/svg+xml")).toBe(false);
  });

  it("rejects an empty type", () => {
    expect(isAllowedMimeType("")).toBe(false);
  });
});

describe("listAllowedMimeTypes", () => {
  it("returns a non-empty, unique list", () => {
    const types = listAllowedMimeTypes();
    expect(types.length).toBeGreaterThan(0);
    expect(new Set(types).size).toBe(types.length);
  });

  it("never contains a scriptable type", () => {
    const types = listAllowedMimeTypes();
    expect(types).not.toContain("text/html");
    expect(types).not.toContain("image/svg+xml");
    expect(types).not.toContain("application/xhtml+xml");
  });
});

describe("isInlineSafeMimeType", () => {
  it("allows inert types to be rendered inline", () => {
    expect(isInlineSafeMimeType("image/png")).toBe(true);
    expect(isInlineSafeMimeType("application/pdf")).toBe(true);
    expect(isInlineSafeMimeType("text/plain")).toBe(true);
  });

  it("rejects scriptable types", () => {
    expect(isInlineSafeMimeType("text/html")).toBe(false);
    expect(isInlineSafeMimeType("image/svg+xml")).toBe(false);
    expect(isInlineSafeMimeType("application/xhtml+xml")).toBe(false);
  });

  it("rejects XML because it can reference an active stylesheet", () => {
    expect(isInlineSafeMimeType("application/xml")).toBe(false);
    expect(isInlineSafeMimeType("text/xml")).toBe(false);
  });

  it("normalises the type before checking it", () => {
    expect(isInlineSafeMimeType("TEXT/HTML; charset=utf-8")).toBe(false);
  });
});

describe("getFileCategory", () => {
  it("maps images, documents and code", () => {
    expect(getFileCategory("image/jpeg")).toBe("image");
    expect(getFileCategory("application/pdf")).toBe("pdf");
    expect(getFileCategory("text/x-python")).toBe("code");
  });

  it("falls back to the generic category", () => {
    expect(getFileCategory("application/unknown")).toBe("file");
  });
});

describe("getExtensionForMime", () => {
  it("returns the canonical extension", () => {
    expect(getExtensionForMime("image/jpeg")).toBe("jpg");
  });

  it("falls back to bin", () => {
    expect(getExtensionForMime("application/unknown")).toBe("bin");
  });
});

describe("getMimeLabel", () => {
  it("returns a human readable label", () => {
    expect(getMimeLabel("image/png")).toBe("PNG image");
  });
});

describe("inferMimeTypeFromName", () => {
  it("prefers the browser supplied type when it is allowed", () => {
    expect(inferMimeTypeFromName("photo.png", "image/png")).toBe("image/png");
  });

  it("falls back to the extension for unknown browser types", () => {
    expect(inferMimeTypeFromName("notes.md", "")).toBe("text/markdown");
  });

  it("ignores a disallowed browser type", () => {
    expect(inferMimeTypeFromName("script.sh", "application/x-sh")).toBe(
      "text/x-shellscript",
    );
  });

  it("returns an empty type for unknown extensions so the allow-list rejects it", () => {
    expect(inferMimeTypeFromName("mystery.qqq", "")).toBe("");
  });
});
