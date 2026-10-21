import "server-only";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { authConfig } from "@/lib/auth/config";
import { loginSchema } from "@/lib/validation/schemas";

/**
 * Full (Node.js runtime) authentication configuration.
 *
 * Sessions are stateless JWTs: the cookie is signed, `httpOnly`, `sameSite=lax`
 * and `secure` in production, so it cannot be read by client-side JavaScript
 * and is not sent on cross-site requests (CSRF protection).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            passwordHash: true,
          },
        });

        // Always run a hash comparison to keep the response time constant and
        // avoid user enumeration through timing differences.
        const passwordHash =
          user?.passwordHash ??
          "$2a$12$0000000000000000000000000000000000000000000000000000";
        const isValid = await verifyPassword(password, passwordHash);

        if (!user || !user.passwordHash || !isValid) return null;

        await prisma.user
          .update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          .catch(() => undefined);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
});
