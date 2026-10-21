import "server-only";

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
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const id = session?.user?.id;

  if (!id) return null;

  return {
    id,
    email: session.user.email ?? "",
    name: session.user.name ?? "User",
    role: session.user.role ?? "USER",
  };
}
