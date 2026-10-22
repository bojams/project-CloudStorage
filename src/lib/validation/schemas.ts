import { z } from "zod";

import {
  MAX_NAME_LENGTH,
  MAX_UPLOAD_SIZE_ABSOLUTE,
  MAX_FOLDER_DEPTH,
} from "@/lib/constants";

/**
 * Every server action validates its input with one of these schemas before a
 * single line of business logic runs. Zod output is fully typed, so actions
 * receive narrowed, trusted data.
 */

const nameField = z
  .string({ error: "Name is required." })
  .trim()
  .min(1, "Name is required.")
  .max(MAX_NAME_LENGTH, `Name must be at most ${MAX_NAME_LENGTH} characters.`);

export const uuidSchema = z.uuid("Invalid identifier.");
export const nullableUuidSchema = z.uuid("Invalid identifier.").nullable();

const emailField = z
  .string({ error: "Email is required." })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

export const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ error: "Password is required." })
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password is too long."),
});

export const registerSchema = z
  .object({
    name: nameField.max(80, "Name must be at most 80 characters."),
    email: emailField,
    password: z
      .string({ error: "Password is required." })
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password is too long.")
      .regex(/[a-zA-Z]/, "Password must contain a letter.")
      .regex(/[0-9]/, "Password must contain a number."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const createFolderSchema = z.object({
  name: nameField,
  parentId: nullableUuidSchema.optional(),
});

export const renameSchema = z.object({
  id: uuidSchema,
  target: z.enum(["file", "folder"]),
  name: nameField,
});

export const moveSchema = z.object({
  id: uuidSchema,
  target: z.enum(["file", "folder"]),
  destinationFolderId: nullableUuidSchema,
});

export const deleteSchema = z.object({
  id: uuidSchema,
  target: z.enum(["file", "folder"]),
  permanent: z.boolean().default(false),
});

export const restoreSchema = z.object({
  id: uuidSchema,
  target: z.enum(["file", "folder"]),
});

export const uploadRequestSchema = z.object({
  fileName: nameField,
  size: z
    .number({ error: "File size is required." })
    .int()
    .positive("File size must be greater than zero.")
    .max(MAX_UPLOAD_SIZE_ABSOLUTE, "File is too large."),
  mimeType: z
    .string()
    .min(1)
    .max(255)
    .transform((value) => value.split(";")[0]?.trim().toLowerCase() ?? ""),
  folderId: nullableUuidSchema.optional(),
});

export const completeUploadSchema = z.object({
  fileId: uuidSchema,
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_SIZE_ABSOLUTE),
});

export const abortUploadSchema = z.object({
  fileId: uuidSchema,
});

export const shareCreateSchema = z.object({
  targetId: uuidSchema,
  target: z.enum(["file", "folder"]),
  permission: z.enum(["VIEW", "EDIT"]).default("VIEW"),
  expiresInDays: z.number().int().min(1).max(365).nullable().default(null),
  recipientEmail: emailField.nullable().default(null),
  note: z.string().max(500).nullable().default(null),
});

export const shareRevokeSchema = z.object({
  shareId: uuidSchema,
});

export const folderDepthSchema = z.number().int().min(0).max(MAX_FOLDER_DEPTH);

/** Payload of a request that uploads a new revision of an existing file. */
export const versionUploadRequestSchema = z.object({
  fileId: uuidSchema,
  fileName: nameField,
  size: z
    .number({ error: "File size is required." })
    .int()
    .positive("File size must be greater than zero.")
    .max(MAX_UPLOAD_SIZE_ABSOLUTE, "File is too large."),
  mimeType: z
    .string()
    .min(1)
    .max(255)
    .transform((value) => value.split(";")[0]?.trim().toLowerCase() ?? ""),
});

export const versionCompleteSchema = z.object({
  fileId: uuidSchema,
  versionId: uuidSchema,
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_SIZE_ABSOLUTE),
});

export const versionSelectSchema = z.object({
  fileId: uuidSchema,
  versionId: uuidSchema,
});

export const planChangeSchema = z.object({
  plan: z.enum(["FREE", "PREMIUM"]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type RenameInput = z.infer<typeof renameSchema>;
export type MoveInput = z.infer<typeof moveSchema>;
export type DeleteInput = z.infer<typeof deleteSchema>;
export type RestoreInput = z.infer<typeof restoreSchema>;
export type UploadRequestInput = z.infer<typeof uploadRequestSchema>;
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
export type AbortUploadInput = z.infer<typeof abortUploadSchema>;
export type ShareCreateInput = z.infer<typeof shareCreateSchema>;
export type ShareRevokeInput = z.infer<typeof shareRevokeSchema>;
export type VersionUploadRequestInput = z.infer<
  typeof versionUploadRequestSchema
>;
export type VersionCompleteInput = z.infer<typeof versionCompleteSchema>;
export type VersionSelectInput = z.infer<typeof versionSelectSchema>;
export type PlanChangeInput = z.infer<typeof planChangeSchema>;
