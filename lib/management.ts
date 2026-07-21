import "server-only";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { cache } from "react";
import { checkManagementCloudAccess } from "@/lib/cloud-access";
import { CloudAccessError } from "@/lib/api/helpers";

export const getSession = cache(async () => {
  const hdrs = await headers();
  return auth.api.getSession({ headers: hdrs });
});

export const getCurrentManagementId = cache(async () => {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { activeManagementId: true },
  });

  if (user?.activeManagementId) {
    const membership = await prisma.managementMember.findFirst({
      where: { userId: session.user.id, managementId: user.activeManagementId },
    });
    if (membership) return membership.managementId;
  }

  const membership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) throw new Error("No management found");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { activeManagementId: membership.managementId },
  });

  return membership.managementId;
});

export async function assertManagementAccess(managementId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const membership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id, managementId },
  });
  if (!membership) throw new Error("Anda bukan anggota management ini");

  const cloudAccess = await checkManagementCloudAccess(session.user.id, managementId);
  if (!cloudAccess.allowed) throw new CloudAccessError(cloudAccess.reason);

  return { session, managementId };
}

export async function resolveManagementId(managementId?: string) {
  const resolvedManagementId = managementId ?? await getCurrentManagementId();
  await assertManagementAccess(resolvedManagementId);
  return resolvedManagementId;
}

export async function activateManagement(managementId: string) {
  const { session } = await assertManagementAccess(managementId);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { activeManagementId: managementId },
  });
}
