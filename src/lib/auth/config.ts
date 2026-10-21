import type { NextAuthConfig } from "next-auth";

import { SESSION_MAX_AGE } from "@/lib/constants";

/**
 * Edge-safe authentication configuration.
 *
 * This file is imported by `middleware.ts`, therefore it must not pull in
 * Prisma, bcrypt, or any other Node.js-only dependency. The full
 * configuration (with the database-backed credentials provider) lives in
 * `src/lib/auth/index.ts` and reuses everything defined here.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
  },
  trustHost: process.env.AUTH_TRUST_HOST !== "false",
  // Providers are injected by the Node.js runtime configuration.
  providers: [],
  callbacks: {
    /**
     * The JWT carries the user id and role. No database call happens here so
     * the callback stays edge compatible.
     */
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id ?? token.sub;
        const role = (user as { role?: string }).role;
        token.role = role === "ADMIN" ? "ADMIN" : "USER";
        token.picture = user.image ?? token.picture;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.sub === "string" ? token.sub : "";
        const role = (token.role as string | undefined) ?? "USER";
        session.user.role = role === "ADMIN" ? "ADMIN" : "USER";
        session.user.image = token.picture ?? session.user.image;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
