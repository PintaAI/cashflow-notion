"use server";

import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/management";

export async function getCurrentManagement() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const membership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id },
    include: {
      management: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true, image: true } } },
          },
        },
      },
    },
  });

  return membership;
}

export async function createInvite() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const membership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id, role: "owner" },
  });
  if (!membership) throw new Error("Only management owner can create invites");

  const code = crypto.randomBytes(4).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.invitation.create({
    data: {
      managementId: membership.managementId,
      code,
      expiresAt,
    },
  });

  return code;
}

export async function acceptInvite(code: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const invitation = await prisma.invitation.findUnique({
    where: { code },
  });
  if (!invitation) throw new Error("Undangan tidak ditemukan");
  if (invitation.status !== "pending") throw new Error("Undangan sudah digunakan");
  if (invitation.expiresAt < new Date()) throw new Error("Undangan sudah kadaluarsa");

  const existingMember = await prisma.managementMember.findFirst({
    where: { managementId: invitation.managementId, userId: session.user.id },
  });
  if (existingMember) throw new Error("Anda sudah menjadi anggota management ini");

  const userManagement = await prisma.managementMember.findFirst({
    where: { userId: session.user.id, role: "owner" },
    include: { management: true },
  });

  await prisma.$transaction(async (tx) => {
    if (userManagement && userManagement.managementId !== invitation.managementId) {
      await tx.category.updateMany({
        where: { managementId: userManagement.managementId },
        data: { managementId: invitation.managementId },
      });
      await tx.entry.updateMany({
        where: { managementId: userManagement.managementId },
        data: { managementId: invitation.managementId },
      });
      await tx.quickFill.updateMany({
        where: { managementId: userManagement.managementId },
        data: { managementId: invitation.managementId },
      });
      await tx.management.delete({ where: { id: userManagement.managementId } });
    }

    await tx.managementMember.create({
      data: {
        managementId: invitation.managementId,
        userId: session.user.id,
        role: "member",
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted" },
    });
  });
}

export async function getInvitationInfo(code: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { code },
    include: {
      management: {
        select: { name: true },
      },
    },
  });
  if (!invitation) return null;
  if (invitation.expiresAt < new Date()) return null;

  return {
    managementName: invitation.management.name,
    expiresAt: invitation.expiresAt.toISOString(),
  };
}

export async function regenerateMcpApiKey() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const key = "mcp_" + crypto.randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: session.user.id },
    data: { mcpApiKey: key },
  });

  return key;
}

export async function getMcpApiKey() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mcpApiKey: true },
  });

  return user?.mcpApiKey ?? null;
}
