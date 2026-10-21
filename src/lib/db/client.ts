import { PrismaClient } from "@prisma/client";

/**
 * A single Prisma client instance per process.
 *
 * In development Next.js hot-reloads modules, which would otherwise open a
 * new connection pool on every reload until PostgreSQL refuses connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
