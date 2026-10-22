import { describe, expect, it } from "vitest";

import {
  cn,
  createOpaqueId,
  formatBytes,
  formatDateTime,
  formatPercent,
  formatRelativeDate,
  initials,
} from "@/lib/utils";

describe("formatBytes", () => {
  it("formats bytes, kilobytes, megabytes and gigabytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024 * 5)).toBe("5.0 MB");
    expect(formatBytes(1024 ** 3 * 2)).toBe("2.0 GB");
  });

  it("never renders a negative or invalid size", () => {
    expect(formatBytes(-10)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });
});

describe("formatPercent", () => {
  it("rounds to the nearest whole percent", () => {
    expect(formatPercent(50, 200)).toBe(25);
  });

  it("never exceeds 100 or drops below 0", () => {
    expect(formatPercent(500, 200)).toBe(100);
    expect(formatPercent(-10, 200)).toBe(0);
  });

  it("returns 0 for an invalid total", () => {
    expect(formatPercent(10, 0)).toBe(0);
  });
});

describe("formatRelativeDate", () => {
  it("describes recent timestamps", () => {
    expect(formatRelativeDate(new Date())).toBe("Just now");
    expect(formatRelativeDate(new Date(Date.now() - 5 * 60_000))).toBe("5m ago");
    expect(formatRelativeDate(new Date(Date.now() - 3 * 3_600_000))).toBe("3h ago");
    expect(formatRelativeDate(new Date(Date.now() - 2 * 86_400_000))).toBe("2d ago");
  });

  it("falls back to a calendar date after a week", () => {
    const old = new Date(Date.now() - 30 * 86_400_000);
    expect(formatRelativeDate(old)).toMatch(/\d{1,2}/);
  });

  it("accepts an ISO string", () => {
    expect(formatRelativeDate(new Date().toISOString())).toBe("Just now");
  });
});

describe("formatDateTime", () => {
  it("renders a readable date and time", () => {
    const value = formatDateTime("2026-01-15T10:30:00.000Z");
    expect(value).toContain("2026");
  });
});

describe("initials", () => {
  it("uses the first letter of the first two words", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
  });

  it("handles a single word", () => {
    expect(initials("Ada")).toBe("A");
  });

  it("returns an empty string for an empty name", () => {
    expect(initials("   ")).toBe("");
  });
});

describe("createOpaqueId", () => {
  it("creates unique uuids", () => {
    const first = createOpaqueId();
    const second = createOpaqueId();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("cn", () => {
  it("merges conflicting tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("keeps unrelated classes", () => {
    expect(cn("flex", "items-center")).toBe("flex items-center");
  });
});
