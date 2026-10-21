import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import {
  type ActionError,
  type ActionErrorCode,
  type ActionResult,
  defaultMessage,
  fail,
} from "@/lib/result";

/**
 * Normalises any thrown value into a safe, user-facing `ActionError`.
 * Sensitive details (stack traces, SQL, driver messages) never reach the client.
 */
export function toActionError(error: unknown): ActionError {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "_root";
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return {
      code: "VALIDATION_ERROR",
      message: defaultMessage("VALIDATION_ERROR"),
      fieldErrors,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return {
          code: "CONFLICT",
          message: "An item with the same name already exists here.",
        };
      case "P2025":
        return { code: "NOT_FOUND", message: defaultMessage("NOT_FOUND") };
      case "P2003":
        return {
          code: "FORBIDDEN",
          message: defaultMessage("FORBIDDEN"),
        };
      default:
        return {
          code: "INTERNAL_ERROR",
          message: defaultMessage("INTERNAL_ERROR"),
        };
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { code: "INTERNAL_ERROR", message: defaultMessage("INTERNAL_ERROR") };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      code: "STORAGE_ERROR",
      message: "The database is currently unreachable. Please try again later.",
    };
  }

  if (error instanceof Error && error.name === "StorageError") {
    return { code: "STORAGE_ERROR", message: error.message };
  }

  return { code: "INTERNAL_ERROR", message: defaultMessage("INTERNAL_ERROR") };
}

/**
 * Wraps a server-action body with uniform error handling + logging.
 * The callback receives the parsed/validated input and returns a result.
 */
export async function runAction<TInput, TOutput>(
  input: TInput,
  handler: (input: TInput) => Promise<ActionResult<TOutput>>,
  context: { action: string },
): Promise<ActionResult<TOutput>> {
  try {
    return await handler(input);
  } catch (error) {
    logServerError(context.action, error);
    return { ok: false, error: toActionError(error) };
  }
}

export function logServerError(scope: string, error: unknown): void {
  if (process.env.NODE_ENV === "test") return;

  if (error instanceof Error) {
    console.error(`[${scope}]`, error.message, error.stack ?? "");
    return;
  }
  console.error(`[${scope}]`, error);
}

export function errorWithCode(
  code: ActionErrorCode,
  message?: string,
): ActionResult<never> {
  return fail(code, message ?? defaultMessage(code));
}
