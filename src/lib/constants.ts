/** Shared, dependency-free constants used across the application. */

/** Maximum size of a single upload (bytes). */
export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100 MB

/** Default per-user storage quota (bytes). */
export const DEFAULT_STORAGE_QUOTA = 5 * 1024 * 1024 * 1024; // 5 GB

/** Maximum number of items that can be returned by a single listing query. */
export const MAX_PAGE_SIZE = 500;

/** Session lifetime (seconds). */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Lifetime of a signed upload grant (seconds). */
export const UPLOAD_GRANT_TTL = 60 * 15; // 15 minutes

/** Lifetime of a signed download grant (seconds). */
export const DOWNLOAD_GRANT_TTL = 60 * 10; // 10 minutes

/** Maximum length of a file/folder name (UTF-16 code units). */
export const MAX_NAME_LENGTH = 255;

/** Folder nesting depth limit — protects against accidental infinite trees. */
export const MAX_FOLDER_DEPTH = 12;

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  drive: "/drive",
  shared: "/shared",
  recent: "/recent",
  trash: "/trash",
  settings: "/settings",
} as const;

export const APP_NAME = "Nimbus Drive";
export const APP_DESCRIPTION =
  "A secure, fast, and beautifully minimal cloud drive for your files.";
