import { prisma } from "@/lib/db";

const PREMIUM_ENTITLEMENT_KEY = "premium";
const PRODUCTION_ENVIRONMENT = "production";
const ENTITLEMENT_GRACE_MS = 24 * 60 * 60 * 1000;

export type CloudAccessResult = {
  allowed: boolean;
  reason: string;
};

export function isBillingEnforcementEnabled() {
  return process.env.BILLING_ENFORCEMENT_ENABLED === "true";
}

export async function checkPersonalCloudAccess(userId: string): Promise<CloudAccessResult> {
  if (!isBillingEnforcementEnabled()) return { allowed: true, reason: "enforcement-disabled" };
  const entitlement = await prisma.userEntitlement.findUnique({
    where: {
      userId_entitlementKey_environment: {
        userId,
        entitlementKey: PREMIUM_ENTITLEMENT_KEY,
        environment: PRODUCTION_ENVIRONMENT,
      },
    },
    select: { active: true, reconciledAt: true },
  });

  if (!entitlement?.active || entitlement.reconciledAt < new Date(Date.now() - ENTITLEMENT_GRACE_MS)) {
    return { allowed: false, reason: "CLOUD_SYNC_REQUIRED" };
  }

  return { allowed: true, reason: "ok" };
}

export async function checkManagementCloudAccess(
  userId: string,
  managementId: string,
): Promise<CloudAccessResult> {
  if (!isBillingEnforcementEnabled()) return { allowed: true, reason: "enforcement-disabled" };
  const membership = await prisma.managementMember.findFirst({
    where: { userId, managementId },
    select: { management: { select: { cloudSponsorUserId: true } } },
  });

  if (!membership) {
    return { allowed: false, reason: "SHARED_WALLET_SPONSOR_INVALID" };
  }

  const { cloudSponsorUserId } = membership.management;
  if (!cloudSponsorUserId) {
    return { allowed: false, reason: "SHARED_WALLET_SPONSOR_INVALID" };
  }

  const sponsorOwner = await prisma.managementMember.findFirst({
    where: {
      managementId,
      userId: cloudSponsorUserId,
      role: "owner",
    },
  });

  if (!sponsorOwner) {
    return { allowed: false, reason: "SHARED_WALLET_SPONSOR_INVALID" };
  }

  const sponsorEntitlement = await prisma.userEntitlement.findUnique({
    where: {
      userId_entitlementKey_environment: {
        userId: cloudSponsorUserId,
        entitlementKey: PREMIUM_ENTITLEMENT_KEY,
        environment: PRODUCTION_ENVIRONMENT,
      },
    },
    select: { active: true, reconciledAt: true },
  });

  if (!sponsorEntitlement?.active || sponsorEntitlement.reconciledAt < new Date(Date.now() - ENTITLEMENT_GRACE_MS)) {
    return { allowed: false, reason: "SHARED_WALLET_PREMIUM_INACTIVE" };
  }

  return { allowed: true, reason: "ok" };
}
