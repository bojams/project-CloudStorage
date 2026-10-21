import "server-only";

import DOMPurify from "isomorphic-dompurify";

import { MAX_NAME_LENGTH } from "@/lib/constants";

/**
 * Input sanitisation utilities (OWASP A03 — Injection / XSS).
 *
 *  * File and folder names are normalised into a strict allow-list so they can
 *    never contain path separators, control characters, or shell metacharacters.
 *  * Free text is stripped of *all* HTML before it is stored or rendered.
 *  * React escapes by default; `dangerouslySetInnerHTML` is never used in this
 *    codebase, which is the primary defence against stored XSS.
 */

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/g;
const BIDI_OVERRIDES = /[\u202A-\u202E\u2066-\u2069]/g;
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const ILLEGAL_FILENAME_CHARACTERS = /[<>:"/\\|?*]/g;
const RESERVED_WINDOWS_NAMES =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export class SanitizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SanitizationError";
  }
}

function stripInvisible(input: string): string {
  return input
    .replace(CONTROL_CHARACTERS, "")
    .replace(BIDI_OVERRIDES, "")
    .replace(ZERO_WIDTH, "");
}

/**
 * Sanitises a user supplied file/folder name.
 *
 * @throws {SanitizationError} when the name is empty or only made of dots.
 */
export function sanitizeName(rawName: string): string {
  if (typeof rawName !== "string") {
    throw new SanitizationError("Invalid name.");
  }

  let name = rawName.normalize("NFKC");
  name = stripInvisible(name);
  name = name.replace(ILLEGAL_FILENAME_CHARACTERS, "_");
  name = name.replace(/\s+/g, " ").trim();
  // Windows disallows trailing dots and spaces.
  name = name.replace(/[. ]+$/g, "");
  name = name.slice(0, MAX_NAME_LENGTH).replace(/[. ]+$/g, "").trim();

  if (name.length === 0) {
    throw new SanitizationError("Name cannot be empty.");
  }
  if (name === "." || name === "..") {
    throw new SanitizationError("Invalid name.");
  }
  if (RESERVED_WINDOWS_NAMES.test(name)) {
    throw new SanitizationError(
      `"${name}" is a reserved device name and cannot be used.`,
    );
  }

  return name;
}

/** Case-insensitive key used for duplicate detection. */
export function toNameKey(name: string): string {
  return name.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

/**
 * Removes every HTML tag and control character from a free-text field.
 * Used for share notes, display names, etc.
 */
export function sanitizePlainText(
  rawText: string,
  maxLength = 2000,
): string {
  if (typeof rawText !== "string") return "";

  const withoutMarkup = DOMPurify.sanitize(rawText, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  return stripInvisible(withoutMarkup).trim().slice(0, maxLength);
}

/** Escapes a value that will be embedded into a URL query string. */
export function encodeQueryValue(value: string): string {
  return encodeURIComponent(value);
}
