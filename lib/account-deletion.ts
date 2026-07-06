import { prisma } from "@/lib/db";
import { readSubscriptions, writeSubscriptions } from "@/lib/notifications";

export type AccountDeletionResult = {
  success: true;
  deletedManagements: number;
  deletedNotes: number;
  removedPushSubscriptions: number;
};

export async function deleteAccount(userId: string): Promise<AccountDeletionResult> {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw new Error("User not found");
    }

    const memberships = await tx.managementMember.findMany({
      where: { userId },
      select: { managementId: true, role: true },
    });
    const deletedManagementIds: string[] = [];

    for (const membership of memberships) {
      const remainingMembers = await tx.managementMember.findMany({
        where: { managementId: membership.managementId, userId: { not: userId } },
        orderBy: { joinedAt: "asc" },
        select: { id: true, role: true },
      });

      if (remainingMembers.length === 0) {
        await tx.management.delete({ where: { id: membership.managementId } });
        deletedManagementIds.push(membership.managementId);
        continue;
      }

      if (membership.role === "owner" && !remainingMembers.some((member) => member.role === "owner")) {
        await tx.managementMember.update({
          where: { id: remainingMembers[0].id },
          data: { role: "owner" },
        });
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

    await tx.oAuthAuthorizationCode.deleteMany({ where: { userId } });
    await tx.oAuthToken.deleteMany({ where: { userId } });
    await tx.oAuthConsent.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });

    return {
      deletedManagementIds,
      deletedNotes: deletedNoteIds.length,
    };
  });

  const removedPushSubscriptions = await removeAccountPushSubscriptions(userId, result.deletedManagementIds);

  return {
    success: true,
    deletedManagements: result.deletedManagementIds.length,
    deletedNotes: result.deletedNotes,
    removedPushSubscriptions,
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
