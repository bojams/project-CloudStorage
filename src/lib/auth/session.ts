import "server-only";

import { cache } from "react";

import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";

export interface CurrentUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
}

/**
 * Resolves the currently authenticated user from the signed session cookie.
 * Returns `null` when the request is anonymous — every action must handle
 * that case explicitly (defence in depth: the middleware already blocks
 * anonymous access to the app routes).
 *
 * The result is memoised per request: the layout and the page it renders both
 * need the session, and decoding the token twice is pure overhead.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;

  if (!id) return null;

  return {
    id,
    email: session.user.email ?? "",
    name: session.user.name ?? "User",
    role: session.user.role ?? "USER",
  };
});
