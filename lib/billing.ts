import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { fetchRevenueCatEntitlements } from "@/lib/revenuecat";

const PREMIUM_ENTITLEMENT_KEY = "premium";
const PRODUCTION_ENVIRONMENT = "production";
const ENTITLEMENT_GRACE_MS = 24 * 60 * 60 * 1000;

export async function ensureRevenueCatAppUserId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { revenueCatAppUserId: true },
  });
  if (!user) throw new Error("User not found");
  if (user.revenueCatAppUserId) return user.revenueCatAppUserId;

  await prisma.user.updateMany({
    where: { id: userId, revenueCatAppUserId: null },
    data: { revenueCatAppUserId: randomUUID() },
  });
  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: { revenueCatAppUserId: true },
  });
  if (!updated?.revenueCatAppUserId) throw new Error("Unable to create RevenueCat identity");
  return updated.revenueCatAppUserId;
}

export async function reconcileBilling(userId: string) {
  const appUserId = await ensureRevenueCatAppUserId(userId);
  const projections = await fetchRevenueCatEntitlements(appUserId, PREMIUM_ENTITLEMENT_KEY);
  const reconciledAt = new Date();

  await prisma.$transaction(
    projections.map((projection) =>
      prisma.userEntitlement.upsert({
        where: {
          userId_entitlementKey_environment: {
            userId,
            entitlementKey: projection.entitlementKey,
            environment: projection.environment,
          },
        },
        create: { userId, ...projection, reconciledAt },
        update: { ...projection, reconciledAt },
      }),
    ),
  );

  return getBillingStatus(userId);
}

export async function getBillingStatus(userId: string) {
  const appUserId = await ensureRevenueCatAppUserId(userId);
  const freshnessCutoff = new Date(Date.now() - ENTITLEMENT_GRACE_MS);
  const [entitlement, memberships] = await Promise.all([
    prisma.userEntitlement.findUnique({
      where: {
        userId_entitlementKey_environment: {
          userId,
          entitlementKey: PREMIUM_ENTITLEMENT_KEY,
          environment: PRODUCTION_ENVIRONMENT,
        },
      },
    }),
    prisma.managementMember.findMany({
      where: { userId },
      select: {
        management: {
          select: {
            id: true,
            cloudSponsorUserId: true,
            members: { where: { role: "owner" }, select: { userId: true } },
            cloudSponsor: {
              select: {
                entitlements: {
                  where: {
                    entitlementKey: PREMIUM_ENTITLEMENT_KEY,
                    environment: PRODUCTION_ENVIRONMENT,
                    active: true,
                    reconciledAt: { gte: freshnessCutoff },
                  },
                  select: { active: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const managements = Object.fromEntries(
    memberships.map(({ management }) => {
      const sponsorIsOwner = management.members.some(
        (member) => member.userId === management.cloudSponsorUserId,
      );
      const sponsorPremium = management.cloudSponsor?.entitlements[0]?.active === true;
      const cloudSync = sponsorIsOwner && sponsorPremium;
      return [
        management.id,
        {
          cloudSync,
          sponsoredByCurrentUser: management.cloudSponsorUserId === userId,
          sponsorUserId: management.cloudSponsorUserId,
          reason: cloudSync
            ? management.cloudSponsorUserId === userId
              ? "owner-premium"
              : "sponsored-member"
            : management.cloudSponsorUserId
              ? "sponsor-premium-inactive"
              : "sponsor-missing",
        },
      ];
    }),
  );
  const entitlementActive = entitlement?.active === true && entitlement.reconciledAt >= freshnessCutoff;

  return {
    appUserId,
    entitlement: {
      key: PREMIUM_ENTITLEMENT_KEY,
      active: entitlementActive,
      source: entitlement?.periodType ?? null,
      productId: entitlement?.productId ?? null,
      expiresAt: entitlement?.expiresAt?.toISOString() ?? null,
      lifetime: entitlementActive && entitlement?.expiresAt === null,
      reconciledAt: entitlement?.reconciledAt.toISOString() ?? null,
    },
    personalCloudSync: entitlementActive,
    managements,
  };
}
