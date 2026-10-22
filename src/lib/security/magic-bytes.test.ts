import { describe, expect, it } from "vitest";

import {
  detectMimeType,
  isContentTypeConsistent,
} from "@/lib/security/magic-bytes";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

describe("detectMimeType", () => {
  it("detects PNG", () => {
    expect(detectMimeType(PNG)).toBe("image/png");
  });

  it("detects JPEG", () => {
    expect(detectMimeType(JPEG)).toBe("image/jpeg");
  });

  it("detects PDF", () => {
    expect(detectMimeType(PDF)).toBe("application/pdf");
  });

  it("detects ZIP", () => {
    expect(detectMimeType(ZIP)).toBe("application/zip");
  });

  it("detects GIF", () => {
    expect(detectMimeType(GIF)).toBe("image/gif");
  });

  it("returns null for unknown payloads", () => {
    expect(detectMimeType(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });

  it("returns null for an empty buffer", () => {
    expect(detectMimeType(new Uint8Array([]))).toBeNull();
  });
});

describe("isContentTypeConsistent", () => {
  it("accepts a payload that matches the declared type", () => {
    expect(isContentTypeConsistent("image/png", PNG)).toBe(true);
  });

  it("rejects a payload that lies about its type", () => {
    expect(isContentTypeConsistent("image/png", JPEG)).toBe(false);
  });

  it("rejects a PDF masquerading as a PNG", () => {
    expect(isContentTypeConsistent("image/png", PDF)).toBe(false);
  });

  it("accepts types that cannot be sniffed", () => {
    expect(isContentTypeConsistent("text/plain", PNG)).toBe(true);
  });

  it("rejects a truncated signature", () => {
    expect(isContentTypeConsistent("image/png", new Uint8Array([0x89]))).toBe(
      false,
    );
  });
});
