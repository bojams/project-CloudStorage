import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

/**
 * Development seed.
 *
 * Creates a demo account plus a small folder tree so the UI has something to
 * show right after `npm run db:seed`.
 *
 * Run with: `npm run db:seed`
 */

const prisma = new PrismaClient();

const DEMO_EMAIL = process.env.SEED_USER_EMAIL ?? "demo@nimbus.local";
const DEMO_PASSWORD = process.env.SEED_USER_PASSWORD ?? "Demo1234";

async function main(): Promise<void> {
  const passwordHash = await hash(DEMO_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: "Demo User",
      passwordHash,
      role: Role.USER,
      storageQuota: 5n * 1024n * 1024n * 1024n,
    },
  });

  const existingFolder = await prisma.folder.findFirst({
    where: { ownerId: user.id, nameKey: "documents" },
    select: { id: true },
  });

  if (!existingFolder) {
    const documents = await prisma.folder.create({
      data: {
        name: "Documents",
        nameKey: "documents",
        ownerId: user.id,
      },
    });

    await prisma.folder.create({
      data: {
        name: "Reports",
        nameKey: "reports",
        ownerId: user.id,
        parentId: documents.id,
      },
    });

    await prisma.folder.create({
      data: {
        name: "Design",
        nameKey: "design",
        ownerId: user.id,
      },
    });
  }

  process.stdout.write(
    `Seeded demo account ${DEMO_EMAIL} (password: ${DEMO_PASSWORD})\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
