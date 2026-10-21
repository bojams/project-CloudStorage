import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig from "@/lib/auth/config";
import {
  getClientIdentifier,
  LIMITERS,
  rateLimit,
} from "@/lib/security/rate-limit";

/**
 * Edge middleware — the first line of defence for every request.
 *
 * Responsibilities
 *  1. Bounce anonymous users away from the application routes.
 *  2. Apply rate limits to authentication and upload endpoints so that
 *     brute-force and denial-of-service attempts are cheap to detect and
 *     expensive to execute.
 *  3. Keep unauthenticated pages (login/register) reachable.
 *
 * The configuration used here is edge safe: it contains no database or
 * crypto-heavy code, the full configuration lives in `src/lib/auth/index.ts`.
 */

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth",
  "/api/health",
  "/share",
  "/api/public",
  "/api/files/upload",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export default auth(async (request) => {
  const { pathname, search } = request.nextUrl;
  const isPublic = isPublicPath(pathname);

  // ------------------------------------------------------------------
  // Rate limiting
  // ------------------------------------------------------------------
  if (pathname.startsWith("/api/auth/signin") || pathname.startsWith("/api/auth/callback")) {
    const client = getClientIdentifier(request.headers);
    const result = await rateLimit({
      key: `auth:${client}`,
      limit: LIMITERS.login.limit,
      windowMs: LIMITERS.login.windowMs,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Too many authentication attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((result.reset - Date.now()) / 1000),
            ),
          },
        },
      );
    }
  }

  if (pathname.startsWith("/api/files/upload")) {
    const client = getClientIdentifier(request.headers);
    const result = await rateLimit({
      key: `upload:${client}`,
      limit: LIMITERS.uploadBytes.limit,
      windowMs: LIMITERS.uploadBytes.windowMs,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Too many uploads. Please wait a moment." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((result.reset - Date.now()) / 1000),
            ),
          },
        },
      );
    }
  }

  // ------------------------------------------------------------------
  // Authentication gate
  // ------------------------------------------------------------------
  const session = request.auth;

  if (!session?.user?.id && !isPublic) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (session?.user?.id && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/drive", request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
