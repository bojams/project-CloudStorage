/**
 * Shared, framework-agnostic types used by both server and client code.
 * Every date is serialised as an ISO string so the payload stays JSON safe
 * across the React Server Component boundary.
 */

export type ItemType = "file" | "folder";

export type ViewMode = "grid" | "list";

export type SortKey = "name" | "size" | "updatedAt" | "createdAt";

export type SortDirection = "asc" | "desc";

export interface DriveItem {
  readonly id: string;
  readonly type: ItemType;
  readonly name: string;
  readonly mimeType: string | null;
  readonly size: number;
  readonly folderId: string | null;
  readonly parentId: string | null;
  readonly ownerId: string;
  readonly isTrashed: boolean;
  readonly isShared: boolean;
  readonly sharedByMe: boolean;
  /** `false` for items the current user can only read (shared with them). */
  readonly canModify: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Breadcrumb {
  readonly id: string;
  readonly name: string;
}

export interface StorageUsage {
  readonly used: number;
  readonly quota: number;
  readonly percent: number;
  readonly fileCount: number;
}

export interface ShareSummary {
  readonly id: string;
  readonly token: string;
  readonly targetId: string;
  readonly targetType: ItemType;
  readonly targetName: string;
  readonly permission: "VIEW" | "EDIT";
  readonly recipientEmail: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly url: string;
}

export interface FolderNode {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
}

export type UploadStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "completed"
  | "failed"
  | "canceled";

export interface UploadTask {
  readonly id: string;
  readonly fileName: string;
  readonly size: number;
  readonly mimeType: string;
  readonly progress: number;
  readonly status: UploadStatus;
  readonly error: string | null;
  readonly fileId: string | null;
}

export interface SessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly image: string | null;
  readonly role: "USER" | "ADMIN";
}
