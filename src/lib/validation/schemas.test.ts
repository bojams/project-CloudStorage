import { describe, expect, it } from "vitest";

import {
  completeUploadSchema,
  createFolderSchema,
  deleteSchema,
  loginSchema,
  moveSchema,
  registerSchema,
  renameSchema,
  shareCreateSchema,
  shareRevokeSchema,
  uploadRequestSchema,
} from "@/lib/validation/schemas";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("loginSchema", () => {
  it("accepts a valid credential pair", () => {
    const result = loginSchema.safeParse({
      email: "  User@Example.com ",
      password: "password123",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("user@example.com");
  });

  it("rejects a malformed e-mail", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "password123" }).success).toBe(false);
  });

  it("rejects a short password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "short" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "analytical1",
    confirmPassword: "analytical1",
  };

  it("accepts a valid registration", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects mismatching passwords", () => {
    const result = registerSchema.safeParse({
      ...valid,
      confirmPassword: "different1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("confirmPassword");
    }
  });

  it("requires a letter and a number in the password", () => {
    expect(
      registerSchema.safeParse({ ...valid, password: "onlyletters", confirmPassword: "onlyletters" })
        .success,
    ).toBe(false);
  });
});

describe("createFolderSchema", () => {
  it("accepts a name with a parent", () => {
    const result = createFolderSchema.safeParse({
      name: "Documents",
      parentId: UUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(createFolderSchema.safeParse({ name: "  " }).success).toBe(false);
  });

  it("rejects a parent id that is not a uuid", () => {
    expect(
      createFolderSchema.safeParse({ name: "Documents", parentId: "abc" }).success,
    ).toBe(false);
  });
});

describe("renameSchema", () => {
  it("accepts a file and a folder", () => {
    expect(renameSchema.safeParse({ id: UUID, target: "file", name: "a.txt" }).success).toBe(true);
    expect(renameSchema.safeParse({ id: UUID, target: "folder", name: "b" }).success).toBe(true);
  });

  it("rejects an unknown target type", () => {
    expect(
      renameSchema.safeParse({ id: UUID, target: "drive", name: "a" }).success,
    ).toBe(false);
  });
});

describe("moveSchema", () => {
  it("accepts moving to the root", () => {
    const result = moveSchema.safeParse({
      id: UUID,
      target: "file",
      destinationFolderId: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("deleteSchema", () => {
  it("defaults permanent to false", () => {
    const result = deleteSchema.safeParse({ id: UUID, target: "file" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.permanent).toBe(false);
  });
});

describe("uploadRequestSchema", () => {
  it("normalises the mime type", () => {
    const result = uploadRequestSchema.safeParse({
      fileName: "notes.txt",
      size: 120,
      mimeType: "TEXT/PLAIN; charset=utf-8",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mimeType).toBe("text/plain");
  });

  it("rejects a non positive size", () => {
    expect(
      uploadRequestSchema.safeParse({
        fileName: "a.txt",
        size: 0,
        mimeType: "text/plain",
      }).success,
    ).toBe(false);
  });

  it("rejects a size above the absolute upload limit", () => {
    expect(
      uploadRequestSchema.safeParse({
        fileName: "a.bin",
        size: 3 * 1024 * 1024 * 1024,
        mimeType: "application/octet-stream",
      }).success,
    ).toBe(false);
  });

  it("accepts a size that only the premium tier may upload", () => {
    expect(
      uploadRequestSchema.safeParse({
        fileName: "a.bin",
        size: 512 * 1024 * 1024,
        mimeType: "application/octet-stream",
      }).success,
    ).toBe(true);
  });
});

describe("completeUploadSchema", () => {
  it("rejects a mismatching file id", () => {
    expect(
      completeUploadSchema.safeParse({ fileId: "not-a-uuid", size: 10 }).success,
    ).toBe(false);
  });
});

describe("shareCreateSchema", () => {
  it("applies the default permission", () => {
    const result = shareCreateSchema.safeParse({
      targetId: UUID,
      target: "file",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.permission).toBe("VIEW");
      expect(result.data.expiresInDays).toBeNull();
    }
  });

  it("rejects an expiry beyond one year", () => {
    expect(
      shareCreateSchema.safeParse({
        targetId: UUID,
        target: "file",
        expiresInDays: 400,
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed recipient e-mail", () => {
    expect(
      shareCreateSchema.safeParse({
        targetId: UUID,
        target: "file",
        recipientEmail: "not-an-email",
      }).success,
    ).toBe(false);
  });
});

describe("shareRevokeSchema", () => {
  it("requires a uuid", () => {
    expect(shareRevokeSchema.safeParse({ shareId: UUID }).success).toBe(true);
    expect(shareRevokeSchema.safeParse({ shareId: "1" }).success).toBe(false);
  });
});
