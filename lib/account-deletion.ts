import { prisma } from "@/lib/db";
import { readSubscriptions, writeSubscriptions } from "@/lib/notifications";

export type AccountDeletionResult = {
  success: true;
  deletedManagements: number;
  deletedNotes: number;
  removedPushSubscriptions: number;
  suspendedSponsorships: number;
};

export async function deleteAccount(userId: string): Promise<AccountDeletionResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { revenueCatAppUserId: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existingUser) {
      throw new Error("User not found");
    }

    const memberships = await tx.managementMember.findMany({
      where: { userId },
      select: { managementId: true, role: true },
    });
    const deletedManagementIds: string[] = [];
    let suspendedSponsorships = 0;

    for (const membership of memberships) {
      const remainingMembers = await tx.managementMember.findMany({
        where: { managementId: membership.managementId, userId: { not: userId } },
        orderBy: { joinedAt: "asc" },
        select: { id: true, role: true, userId: true },
      });

      if (remainingMembers.length === 0) {
        await tx.management.delete({ where: { id: membership.managementId } });
        deletedManagementIds.push(membership.managementId);
        continue;
      }

      const management = await tx.management.findUnique({
        where: { id: membership.managementId },
        select: { cloudSponsorUserId: true },
      });

      if (management?.cloudSponsorUserId === userId) {
        await tx.management.update({
          where: { id: membership.managementId },
          data: { cloudSponsorUserId: null },
        });
        suspendedSponsorships += 1;
      }

      if (membership.role === "owner" && !remainingMembers.some((member) => member.role === "owner")) {
        const premiumMembers: typeof remainingMembers = [];
        for (const member of remainingMembers) {
          const entitlement = await tx.userEntitlement.findUnique({
            where: {
              userId_entitlementKey_environment: {
                userId: member.userId,
                entitlementKey: "premium",
                environment: "production",
              },
            },
            select: { active: true },
          });
          if (entitlement?.active) {
            premiumMembers.push(member);
          }
        }

        const nextOwner = premiumMembers[0];
        if (nextOwner) {
          await tx.managementMember.update({
            where: { id: nextOwner.id },
            data: { role: "owner" },
          });
        }

        if (nextOwner && management?.cloudSponsorUserId === userId) {
          await tx.management.update({
            where: { id: membership.managementId },
            data: { cloudSponsorUserId: nextOwner.userId },
          });
          suspendedSponsorships -= 1;
        }
      }
    }

    const noteMemberships = await tx.noteMember.findMany({
      where: { userId },
      select: { noteId: true, role: true },
    });
    const deletedNoteIds: string[] = [];

    for (const membership of noteMemberships) {
      const remainingMembers = await tx.noteMember.findMany({
        where: { noteId: membership.noteId, userId: { not: userId } },
        orderBy: { joinedAt: "asc" },
        select: { id: true, role: true },
      });

      if (remainingMembers.length === 0) {
        await tx.note.delete({ where: { id: membership.noteId } });
        deletedNoteIds.push(membership.noteId);
        continue;
      }

      if (membership.role === "owner" && !remainingMembers.some((member) => member.role === "owner")) {
        await tx.noteMember.update({
          where: { id: remainingMembers[0].id },
          data: { role: "owner" },
        });
      }
    }

    if (user?.revenueCatAppUserId) {
      await tx.revenueCatDeletionJob.create({
        data: { revenueCatAppUserId: user.revenueCatAppUserId },
      });
    }

    await tx.oAuthAuthorizationCode.deleteMany({ where: { userId } });
    await tx.oAuthToken.deleteMany({ where: { userId } });
    await tx.oAuthConsent.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });

    return {
      deletedManagementIds,
      deletedNotes: deletedNoteIds.length,
      suspendedSponsorships,
    };
  });

  const removedPushSubscriptions = await removeAccountPushSubscriptions(userId, result.deletedManagementIds);

  return {
    success: true,
    deletedManagements: result.deletedManagementIds.length,
    deletedNotes: result.deletedNotes,
    removedPushSubscriptions,
    suspendedSponsorships: result.suspendedSponsorships,
  };
}

async function removeAccountPushSubscriptions(userId: string, managementIds: string[]) {
  const managementIdSet = new Set(managementIds);
  const subscriptions = await readSubscriptions();
  const nextSubscriptions = subscriptions.filter((subscription) => {
    return subscription.userId !== userId && (!subscription.managementId || !managementIdSet.has(subscription.managementId));
  });

  if (nextSubscriptions.length === subscriptions.length) {
    return 0;
  }

  await writeSubscriptions(nextSubscriptions);
  return subscriptions.length - nextSubscriptions.length;
}
