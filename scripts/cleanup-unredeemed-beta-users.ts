import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ? [process.env.SUPPORT_EMAIL] : [];
const BETA_TESTER_EMAILS = (process.env.BETA_TESTER_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  const deadline = process.argv.includes("--before") ? new Date(process.argv[process.argv.indexOf("--before") + 1]) : new Date();
  const limit = process.argv.includes("--limit") ? Number.parseInt(process.argv[process.argv.indexOf("--limit") + 1], 10) : Infinity;
  const userId = process.argv.includes("--user-id") ? process.argv[process.argv.indexOf("--user-id") + 1] : null;
  const productionConfirmed = process.argv.includes("--confirm-production") &&
    process.argv[process.argv.indexOf("--confirm-production") + 1] === "DELETE_UNREDEEMED_BETA";

  if (!dryRun && !apply) {
    console.log("No mode specified. Use --dry-run to preview, --apply to execute.");
    return;
  }
  if (!userId && BETA_TESTER_EMAILS.length === 0) {
    throw new Error("Set BETA_TESTER_EMAILS or pass --user-id; refusing to target all free users");
  }
  if (apply && !productionConfirmed) {
    throw new Error("Apply requires --confirm-production DELETE_UNREDEEMED_BETA");
  }

  console.log(`Mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
  console.log(`Deadline: ${deadline.toISOString()}`);
  if (limit < Infinity) console.log(`Limit: ${limit}`);

  const unredeemedUsers = await prisma.user.findMany({
    where: {
      ...(userId ? { id: userId } : {}),
      ...(!userId ? { email: { in: BETA_TESTER_EMAILS, notIn: SUPPORT_EMAIL } } : {}),
      createdAt: { lte: deadline },
      betaRedemptions: { none: { redeemedAt: { not: null } } },
      entitlements: {
        none: {
          environment: "production",
          active: true,
        },
      },
      ...(userId ? { email: { notIn: SUPPORT_EMAIL } } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      revenueCatAppUserId: true,
      createdAt: true,
      sponsoredManagements: {
        select: { id: true, name: true, _count: { select: { entries: true, members: true } } },
      },
    },
    take: limit,
  });

  const counts = {
    users: unredeemedUsers.length,
    managements: 0,
    entries: 0,
    notes: 0,
  };

  for (const user of unredeemedUsers) {
    counts.managements += user.sponsoredManagements.length;
    for (const m of user.sponsoredManagements) {
      counts.entries += m._count.entries;
    }

    const noteCount = await prisma.note.count({ where: { members: { some: { userId: user.id } } } });
    counts.notes += noteCount;

    console.log(`  User: ${user.email ?? user.name ?? user.id} (created: ${user.createdAt.toISOString()}, RC: ${user.revenueCatAppUserId ?? "none"})`);
  }

  console.log(`\nTotal affected:`);
  console.log(`  Users: ${counts.users}`);
  console.log(`  Managements: ${counts.managements}`);
  console.log(`  Entries: ${counts.entries}`);
  console.log(`  Notes: ${counts.notes}`);

  if (apply) {
    console.log("\nApplying deletion...");
    let deleted = 0;
    for (const user of unredeemedUsers) {
      try {
        const { deleteAccount } = await import("@/lib/account-deletion");
        await deleteAccount(user.id);
        deleted += 1;
        console.log(`  Deleted: ${user.email ?? user.id}`);
      } catch (error) {
        console.error(`  Failed: ${user.email ?? user.id}`, error instanceof Error ? error.message : error);
      }
    }
    console.log(`\nDeleted ${deleted}/${unredeemedUsers.length} users.`);
  }
}

main()
  .catch((error) => {
    console.error("Cleanup failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
