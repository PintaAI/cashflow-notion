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

  const membership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) throw new Error("No management found");

  return membership.managementId;
});
