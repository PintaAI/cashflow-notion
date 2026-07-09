import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CountRow = { count: bigint };

async function getEntryCount() {
  const rows = await prisma.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS count FROM "Entry"`;
  return rows[0]?.count ?? BigInt(0);
}

async function main() {
  const beforeCount = await getEntryCount();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`ALTER TABLE "Entry" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3)`);
    await tx.$executeRawUnsafe(`UPDATE "Entry" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL`);
    await tx.$executeRawUnsafe(`ALTER TABLE "Entry" ALTER COLUMN "updatedAt" SET NOT NULL`);
  });

  const afterCount = await getEntryCount();
  if (beforeCount !== afterCount) {
    throw new Error(`Entry count changed during migration: before=${beforeCount} after=${afterCount}`);
  }

  console.log(`Entry.updatedAt migration complete. Entries preserved: ${afterCount}`);
}

main()
  .catch((error) => {
    console.error("Entry.updatedAt migration failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
