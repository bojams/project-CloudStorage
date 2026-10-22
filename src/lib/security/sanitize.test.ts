import { describe, expect, it } from "vitest";

import {
  SanitizationError,
  encodeQueryValue,
  sanitizeName,
  sanitizePlainText,
  toNameKey,
} from "@/lib/security/sanitize";

describe("sanitizeName", () => {
  it("keeps ordinary names untouched", () => {
    expect(sanitizeName("Quarterly report.pdf")).toBe("Quarterly report.pdf");
  });

  it("replaces path separators so a name can never escape a directory", () => {
    const result = sanitizeName("../../etc/passwd");
    expect(result).not.toContain("/");
    expect(result).not.toContain("\\");
    expect(result).toBe(".._.._etc_passwd");
  });

  it("rejects a name made of dots only", () => {
    expect(() => sanitizeName("...")).toThrow(SanitizationError);
    expect(() => sanitizeName(". . .")).toThrow(SanitizationError);
  });

  it("replaces characters that are illegal on Windows", () => {
    expect(sanitizeName('a<b>c:d"e|f?g*h')).toBe("a_b_c_d_e_f_g_h");
  });

  it("removes control characters and zero width joiners", () => {
    expect(sanitizeName("in\u0000va\u200blid\u202E")).toBe("invalid");
  });

  it("collapses whitespace and trims the result", () => {
    expect(sanitizeName("  hello    world  ")).toBe("hello world");
  });

  it("strips trailing dots and spaces", () => {
    expect(sanitizeName("name...")).toBe("name");
  });

  it("rejects empty names", () => {
    expect(() => sanitizeName("   ")).toThrow(SanitizationError);
  });

  it("rejects path traversal literals", () => {
    expect(() => sanitizeName("..")).toThrow(SanitizationError);
  });

  it("rejects reserved Windows device names", () => {
    expect(() => sanitizeName("CON")).toThrow(SanitizationError);
    expect(() => sanitizeName("nul.txt")).toThrow(SanitizationError);
  });

  it("truncates to the maximum name length", () => {
    const result = sanitizeName("a".repeat(400));
    expect(result.length).toBe(255);
  });
});

describe("toNameKey", () => {
  it("is case insensitive", () => {
    expect(toNameKey("MyFile.TXT")).toBe(toNameKey("myfile.txt"));
  });

  it("ignores surrounding whitespace", () => {
    expect(toNameKey("  report  ")).toBe("report");
  });
});

describe("sanitizePlainText", () => {
  it("strips every HTML tag", () => {
    expect(sanitizePlainText("<b>bold</b>")).toBe("bold");
  });

  it("removes script payloads entirely", () => {
    const result = sanitizePlainText("<script>alert(1)</script>hello");
    expect(result).not.toContain("script");
    expect(result).toContain("hello");
  });

  it("escapes nothing but keeps plain text intact", () => {
    expect(sanitizePlainText("plain & simple")).toBe("plain & simple");
  });

  it("enforces the maximum length", () => {
    expect(sanitizePlainText("a".repeat(3000), 100)).toHaveLength(100);
  });
});

describe("encodeQueryValue", () => {
  it("escapes characters that would break a query string", () => {
    expect(encodeQueryValue("a&b=c")).toBe("a%26b%3Dc");
  });
});
