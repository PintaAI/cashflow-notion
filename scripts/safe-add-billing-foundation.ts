import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

type UserRow = { id: string; revenueCatAppUserId: string | null };
type ManagementRow = { id: string; cloudSponsorUserId: string | null };

async function main() {
  if (!apply) {
    console.log("Dry run only. Re-run with --apply to create and backfill billing tables.");
  }

  const userCountBefore = await prisma.user.count();
  const managementCountBefore = await prisma.management.count();

  if (!apply) {
    console.log(`Users to preserve: ${userCountBefore}`);
    console.log(`Managements to preserve: ${managementCountBefore}`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "revenueCatAppUserId" TEXT`);
    await tx.$executeRawUnsafe(`ALTER TABLE "Management" ADD COLUMN IF NOT EXISTS "cloudSponsorUserId" TEXT`);

    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserEntitlement" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "entitlementKey" TEXT NOT NULL,
        "active" BOOLEAN NOT NULL DEFAULT false,
        "environment" TEXT NOT NULL,
        "store" TEXT,
        "productId" TEXT,
        "periodType" TEXT,
        "ownership" TEXT,
        "expiresAt" TIMESTAMP(3),
        "revenueCatCustomerId" TEXT,
        "revenueCatOriginalUserId" TEXT,
        "reconciledAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RevenueCatWebhookEvent" (
        "eventId" TEXT PRIMARY KEY,
        "apiVersion" TEXT,
        "eventType" TEXT NOT NULL,
        "appId" TEXT,
        "environment" TEXT,
        "appUserId" TEXT,
        "originalAppUserId" TEXT,
        "aliases" JSONB,
        "rawPayload" JSONB NOT NULL,
        "signatureTimestamp" BIGINT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "processedAt" TIMESTAMP(3),
        "lastError" TEXT
      )
    `);
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BetaRedemptionCode" (
        "id" TEXT PRIMARY KEY,
        "codeHash" TEXT NOT NULL,
        "label" TEXT,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "redeemedByUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
        "redeemedAt" TIMESTAMP(3),
        "grantReference" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "revokedAt" TIMESTAMP(3)
      )
    `);
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RevenueCatDeletionJob" (
        "id" TEXT PRIMARY KEY,
        "revenueCatAppUserId" TEXT NOT NULL,
        "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "revenueCatDeletedAt" TIMESTAMP(3),
        "lastError" TEXT,
        "attempts" INTEGER NOT NULL DEFAULT 0
      )
    `);

    const users = await tx.$queryRaw<UserRow[]>`SELECT "id", "revenueCatAppUserId" FROM "User" FOR UPDATE`;
    for (const user of users) {
      if (!user.revenueCatAppUserId) {
        await tx.$executeRaw`UPDATE "User" SET "revenueCatAppUserId" = ${randomUUID()} WHERE "id" = ${user.id}`;
      }
    }

    const managements = await tx.$queryRaw<ManagementRow[]>`
      SELECT "id", "cloudSponsorUserId" FROM "Management" FOR UPDATE
    `;
    for (const management of managements) {
      if (management.cloudSponsorUserId) continue;
      const owner = await tx.managementMember.findFirst({
        where: { managementId: management.id, role: "owner" },
        orderBy: { joinedAt: "asc" },
        select: { userId: true },
      });
      if (owner) {
        await tx.$executeRaw`
          UPDATE "Management" SET "cloudSponsorUserId" = ${owner.userId} WHERE "id" = ${management.id}
        `;
      }
    }

    await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_revenueCatAppUserId_key" ON "User"("revenueCatAppUserId")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Management_cloudSponsorUserId_idx" ON "Management"("cloudSponsorUserId")`);
    await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "UserEntitlement_userId_entitlementKey_environment_key" ON "UserEntitlement"("userId", "entitlementKey", "environment")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UserEntitlement_entitlementKey_active_idx" ON "UserEntitlement"("entitlementKey", "active")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RevenueCatWebhookEvent_status_receivedAt_idx" ON "RevenueCatWebhookEvent"("status", "receivedAt")`);
    await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "BetaRedemptionCode_codeHash_key" ON "BetaRedemptionCode"("codeHash")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BetaRedemptionCode_redeemedByUserId_idx" ON "BetaRedemptionCode"("redeemedByUserId")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BetaRedemptionCode_expiresAt_idx" ON "BetaRedemptionCode"("expiresAt")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RevenueCatDeletionJob_revenueCatDeletedAt_requestedAt_idx" ON "RevenueCatDeletionJob"("revenueCatDeletedAt", "requestedAt")`);

    await tx.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Management" ADD CONSTRAINT "Management_cloudSponsorUserId_fkey"
          FOREIGN KEY ("cloudSponsorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  }, { timeout: 120_000 });

  const [userCountAfter, managementCountAfter, missingBillingIds] = await Promise.all([
    prisma.user.count(),
    prisma.management.count(),
    prisma.user.count({ where: { revenueCatAppUserId: null } }),
  ]);
  if (userCountBefore !== userCountAfter || managementCountBefore !== managementCountAfter) {
    throw new Error("Billing migration changed user or management counts");
  }
  if (missingBillingIds !== 0) {
    throw new Error(`${missingBillingIds} users are missing RevenueCat IDs`);
  }

  console.log(`Billing foundation migration complete. Users preserved: ${userCountAfter}`);
  console.log(`Managements preserved: ${managementCountAfter}`);
}

main()
  .catch((error) => {
    console.error("Billing foundation migration failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
