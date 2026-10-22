import { describe, expect, it } from "vitest";

import { toDriveItem } from "@/lib/db/mappers";
import type { FileWithRelations, FolderWithRelations } from "@/lib/db/mappers";

const now = new Date("2026-01-01T00:00:00.000Z");

function makeFile(overrides: Partial<FileWithRelations> = {}): FileWithRelations {
  return {
    id: "f1",
    name: "document.pdf",
    mimeType: "application/pdf",
    size: 1024n,
    storageKey: "u/x/f1",
    folderId: null,
    ownerId: "u1",
    isTrashed: false,
    uploadedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as FileWithRelations;
}

function makeFolder(overrides: Partial<FolderWithRelations> = {}): FolderWithRelations {
  return {
    id: "d1",
    name: "Documents",
    parentId: null,
    ownerId: "u1",
    isTrashed: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as FolderWithRelations;
}

describe("toDriveItem", () => {
  it("maps a file", () => {
    const item = toDriveItem(makeFile(), "file");
    expect(item.type).toBe("file");
    expect(item.name).toBe("document.pdf");
    expect(item.mimeType).toBe("application/pdf");
    expect(item.size).toBe(1024);
    expect(item.folderId).toBeNull();
    expect(item.isShared).toBe(false);
    expect(item.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("maps a folder", () => {
    const item = toDriveItem(makeFolder({ parentId: "d0" }), "folder");
    expect(item.type).toBe("folder");
    expect(item.mimeType).toBeNull();
    expect(item.size).toBe(0);
    expect(item.parentId).toBe("d0");
  });

  it("sets isShared when the item has shares", () => {
    const item = toDriveItem(makeFile({ _count: { shares: 3 } }), "file");
    expect(item.isShared).toBe(true);
  });

  it("respects the canModify flag", () => {
    const item = toDriveItem(makeFile(), "file", { canModify: false });
    expect(item.canModify).toBe(false);
  });

  it("defaults canModify to true", () => {
    const item = toDriveItem(makeFile(), "file");
    expect(item.canModify).toBe(true);
  });

  it("serialises dates to ISO strings", () => {
    const item = toDriveItem(makeFile(), "file");
    expect(typeof item.createdAt).toBe("string");
    expect(typeof item.updatedAt).toBe("string");
  });
});
