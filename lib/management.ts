import "server-only";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { cache } from "react";

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
