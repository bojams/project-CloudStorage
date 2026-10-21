/**
 * MIME type allow-list (OWASP A05 — Security Misconfiguration / unrestricted
 * file upload).
 *
 * Only the types below may be uploaded. Everything else is rejected *before*
 * a byte is transferred, both on the client and on the server.
 */

export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "text"
  | "code"
  | "file";

interface MimeDescriptor {
  readonly category: FileCategory;
  readonly extension: string;
  readonly label: string;
}

const MIME_REGISTRY: Readonly<Record<string, MimeDescriptor>> = {
  // Images
  "image/jpeg": { category: "image", extension: "jpg", label: "JPEG image" },
  "image/png": { category: "image", extension: "png", label: "PNG image" },
  "image/gif": { category: "image", extension: "gif", label: "GIF image" },
  "image/webp": { category: "image", extension: "webp", label: "WebP image" },
  "image/avif": { category: "image", extension: "avif", label: "AVIF image" },
  "image/svg+xml": {
    category: "image",
    extension: "svg",
    label: "SVG image",
  },

  // Video
  "video/mp4": { category: "video", extension: "mp4", label: "MP4 video" },
  "video/webm": { category: "video", extension: "webm", label: "WebM video" },
  "video/quicktime": {
    category: "video",
    extension: "mov",
    label: "QuickTime video",
  },

  // Audio
  "audio/mpeg": { category: "audio", extension: "mp3", label: "MP3 audio" },
  "audio/wav": { category: "audio", extension: "wav", label: "WAV audio" },
  "audio/ogg": { category: "audio", extension: "ogg", label: "OGG audio" },
  "audio/flac": { category: "audio", extension: "flac", label: "FLAC audio" },

  // Documents
  "application/pdf": {
    category: "pdf",
    extension: "pdf",
    label: "PDF document",
  },
  "application/msword": {
    category: "document",
    extension: "doc",
    label: "Word document",
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    category: "document",
    extension: "docx",
    label: "Word document",
  },
  "application/vnd.ms-excel": {
    category: "spreadsheet",
    extension: "xls",
    label: "Excel spreadsheet",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    category: "spreadsheet",
    extension: "xlsx",
    label: "Excel spreadsheet",
  },
  "application/vnd.ms-powerpoint": {
    category: "presentation",
    extension: "ppt",
    label: "PowerPoint presentation",
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    category: "presentation",
    extension: "pptx",
    label: "PowerPoint presentation",
  },
  "application/vnd.oasis.opendocument.text": {
    category: "document",
    extension: "odt",
    label: "OpenDocument text",
  },
  "application/vnd.oasis.opendocument.spreadsheet": {
    category: "spreadsheet",
    extension: "ods",
    label: "OpenDocument spreadsheet",
  },
  "application/vnd.oasis.opendocument.presentation": {
    category: "presentation",
    extension: "odp",
    label: "OpenDocument presentation",
  },

  // Archives
  "application/zip": { category: "archive", extension: "zip", label: "ZIP archive" },
  "application/x-tar": {
    category: "archive",
    extension: "tar",
    label: "TAR archive",
  },
  "application/gzip": {
    category: "archive",
    extension: "gz",
    label: "GZIP archive",
  },
  "application/x-7z-compressed": {
    category: "archive",
    extension: "7z",
    label: "7-Zip archive",
  },
  "application/vnd.rar": {
    category: "archive",
    extension: "rar",
    label: "RAR archive",
  },

  // Text & code
  "text/plain": { category: "text", extension: "txt", label: "Text file" },
  "text/markdown": {
    category: "text",
    extension: "md",
    label: "Markdown file",
  },
  "text/csv": { category: "spreadsheet", extension: "csv", label: "CSV file" },
  "text/html": { category: "code", extension: "html", label: "HTML file" },
  "text/css": { category: "code", extension: "css", label: "CSS file" },
  "text/javascript": {
    category: "code",
    extension: "js",
    label: "JavaScript file",
  },
  "application/json": {
    category: "code",
    extension: "json",
    label: "JSON file",
  },
  "application/xml": {
    category: "code",
    extension: "xml",
    label: "XML file",
  },
  "application/x-yaml": {
    category: "code",
    extension: "yaml",
    label: "YAML file",
  },
  "application/sql": { category: "code", extension: "sql", label: "SQL file" },

  // Source code
  "text/x-python": {
    category: "code",
    extension: "py",
    label: "Python source",
  },
  "text/x-java": { category: "code", extension: "java", label: "Java source" },
  "text/x-c": { category: "code", extension: "c", label: "C source" },
  "text/x-c++src": {
    category: "code",
    extension: "cpp",
    label: "C++ source",
  },
  "text/x-typescript": {
    category: "code",
    extension: "ts",
    label: "TypeScript source",
  },
  "text/x-go": { category: "code", extension: "go", label: "Go source" },
  "text/x-rust": { category: "code", extension: "rs", label: "Rust source" },
  "text/x-php": { category: "code", extension: "php", label: "PHP source" },
  "text/x-ruby": { category: "code", extension: "rb", label: "Ruby source" },
  "text/x-shellscript": {
    category: "code",
    extension: "sh",
    label: "Shell script",
  },
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_REGISTRY));

/** SVG is scriptable — it is intentionally *not* part of the allow-list. */
export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(normalizeMimeType(mimeType));
}

export function normalizeMimeType(mimeType: string): string {
  return mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function getMimeDescriptor(mimeType: string): MimeDescriptor {
  const normalized = normalizeMimeType(mimeType);
  return (
    MIME_REGISTRY[normalized] ?? {
      category: "file",
      extension: "bin",
      label: "File",
    }
  );
}

export function getFileCategory(mimeType: string): FileCategory {
  return getMimeDescriptor(mimeType).category;
}

export function getExtensionForMime(mimeType: string): string {
  return getMimeDescriptor(mimeType).extension;
}

export function getMimeLabel(mimeType: string): string {
  return getMimeDescriptor(mimeType).label;
}

export function listAllowedMimeTypes(): readonly string[] {
  return [...ALLOWED_MIME_TYPES];
}

/**
 * Extension → MIME mapping used to infer the type of files for which the
 * browser does not provide one (`file.type === ""`).
 */
const EXTENSION_TO_MIME: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  zip: "application/zip",
  tar: "application/x-tar",
  gz: "application/gzip",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  json: "application/json",
  xml: "application/xml",
  yaml: "application/x-yaml",
  yml: "application/x-yaml",
  sql: "application/sql",
  py: "text/x-python",
  java: "text/x-java",
  c: "text/x-c",
  cpp: "text/x-c++src",
  ts: "text/x-typescript",
  tsx: "text/x-typescript",
  go: "text/x-go",
  rs: "text/x-rust",
  php: "text/x-php",
  rb: "text/x-ruby",
  sh: "text/x-shellscript",
};

/**
 * Resolves the MIME type of a file.
 *
 * The browser supplied type wins when it is part of the allow-list,
 * otherwise the extension is used as a fallback.
 */
export function inferMimeTypeFromName(
  fileName: string,
  browserType = "",
): string {
  const normalizedBrowserType = normalizeMimeType(browserType);
  if (normalizedBrowserType && ALLOWED_MIME_TYPES.has(normalizedBrowserType)) {
    return normalizedBrowserType;
  }

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const inferred = EXTENSION_TO_MIME[extension];
  if (inferred) return inferred;

  return normalizedBrowserType;
}
