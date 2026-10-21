/**
 * A discriminated union used as the return type of every server action.
 *
 * Server actions never throw raw errors to the client: they return a
 * predictable, typed envelope so the UI can render actionable messages while
 * the real cause stays in the server logs.
 */
export type ActionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "UNSUPPORTED_MEDIA"
  | "STORAGE_ERROR"
  | "INTERNAL_ERROR";

export interface ActionError {
  code: ActionErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function okEmpty(): ActionResult<undefined> {
  return { ok: true, data: undefined };
}

/** Default, user-safe message per error code. */
const DEFAULT_MESSAGES: Record<ActionErrorCode, string> = {
  UNAUTHORIZED: "You need to sign in to continue.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested item could not be found.",
  VALIDATION_ERROR: "Some of the information provided is invalid.",
  CONFLICT: "An item with the same name already exists here.",
  RATE_LIMITED: "Too many requests. Please slow down and try again shortly.",
  QUOTA_EXCEEDED: "You have reached your storage limit.",
  UNSUPPORTED_MEDIA: "This file type is not allowed.",
  STORAGE_ERROR: "The storage provider could not complete the request.",
  INTERNAL_ERROR: "Something went wrong on our side. Please try again.",
};

export function fail<T = never>(
  code: ActionErrorCode,
  message?: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<T> {
  const text = message ?? DEFAULT_MESSAGES[code];
  return {
    ok: false,
    error: fieldErrors ? { code, message: text, fieldErrors } : { code, message: text },
  };
}

export function defaultMessage(code: ActionErrorCode): string {
  return DEFAULT_MESSAGES[code];
}
