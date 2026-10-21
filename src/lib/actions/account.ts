"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { logServerError, toActionError } from "@/lib/errors";
import { fail, ok, type ActionResult } from "@/lib/result";
import { getClientIdentifier, LIMITERS, rateLimit } from "@/lib/security/rate-limit";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { registerSchema } from "@/lib/validation/schemas";

/**
 * Account management actions.
 */

export async function registerAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string; email: string }>> {
  try {
    const requestHeaders = await headers();
    const client = getClientIdentifier(requestHeaders);

    const limiter = await rateLimit({
      key: `register:${client}`,
      limit: LIMITERS.register.limit,
      windowMs: LIMITERS.register.windowMs,
    });
    if (!limiter.success) {
      return fail(
        "RATE_LIMITED",
        "Too many accounts were created from this network. Please try again later.",
      );
    }

    const input = registerSchema.parse(rawInput);

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      return fail("CONFLICT", "An account with that email already exists.");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: sanitizePlainText(input.name, 80) || input.name,
        passwordHash,
      },
      select: { id: true, email: true },
    });

    return ok(user);
  } catch (error) {
    logServerError("registerAction", error);
    if (error instanceof z.ZodError) {
      return { ok: false, error: toActionError(error) };
    }
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateProfileAction(
  rawInput: unknown,
): Promise<ActionResult<{ name: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = z
      .object({
        name: z
          .string()
          .trim()
          .min(1, "Name is required.")
          .max(80, "Name must be at most 80 characters."),
      })
      .parse(rawInput);

    const name = sanitizePlainText(input.name, 80);
    if (!name) return fail("VALIDATION_ERROR", "Name is required.");

    await prisma.user.update({
      where: { id: user.id },
      data: { name },
    });

    revalidatePath("/settings");
    return ok({ name });
  } catch (error) {
    logServerError("updateProfileAction", error);
    return { ok: false, error: toActionError(error) };
  }
}

export async function changePasswordAction(
  rawInput: unknown,
): Promise<ActionResult<{ changed: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED");

    const input = z
      .object({
        currentPassword: z.string().min(1, "Current password is required."),
        newPassword: z
          .string()
          .min(8, "Password must be at least 8 characters.")
          .max(128, "Password is too long.")
          .regex(/[a-zA-Z]/, "Password must contain a letter.")
          .regex(/[0-9]/, "Password must contain a number."),
      })
      .parse(rawInput);

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!record?.passwordHash) {
      return fail("FORBIDDEN", "This account does not use a password.");
    }

    const isValid = await verifyPassword(
      input.currentPassword,
      record.passwordHash,
    );
    if (!isValid) {
      return fail("FORBIDDEN", "Your current password is incorrect.");
    }

    const passwordHash = await hashPassword(input.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return ok({ changed: true });
  } catch (error) {
    logServerError("changePasswordAction", error);
    return { ok: false, error: toActionError(error) };
  }
}
