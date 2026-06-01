"use server";

import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/management";

const DEFAULT_CATEGORIES = [
  { name: "Makanan", color: "#ef4444", icon: "utensils" },
  { name: "Transportasi", color: "#f97316", icon: "car" },
  { name: "Belanja", color: "#eab308", icon: "shopping-bag" },
  { name: "Tagihan", color: "#84cc16", icon: "receipt" },
  { name: "Hiburan", color: "#22c55e", icon: "music" },
  { name: "Kesehatan", color: "#14b8a6", icon: "heart" },
  { name: "Pendidikan", color: "#06b6d4", icon: "book" },
  { name: "Rumah Tangga", color: "#3b82f6", icon: "home" },
  { name: "Pakaian & Aksesoris", color: "#6366f1", icon: "shirt" },
  { name: "Asuransi", color: "#8b5cf6", icon: "shield" },
  { name: "Tabungan & Investasi", color: "#a855f7", icon: "piggy-bank" },
  { name: "Hadiah & Donasi", color: "#d946ef", icon: "gift" },
  { name: "Perjalanan", color: "#ec4899", icon: "plane" },
  { name: "Lainnya", color: "#64748b", icon: "more-horizontal" },
  { name: "Gaji", color: "#22c55e", icon: "banknote" },
  { name: "Bonus", color: "#14b8a6", icon: "award" },
  { name: "Freelance", color: "#3b82f6", icon: "laptop" },
  { name: "Investasi", color: "#8b5cf6", icon: "trending-up" },
  { name: "Hadiah", color: "#ec4899", icon: "gift" },
  { name: "Lainnya Pemasukan", color: "#64748b", icon: "more-horizontal" },
];

export type ManagementWithMembers = {
  management: {
    id: string;
    name: string;
    members: {
      id: string;
      role: string;
      user: { id: string; name: string | null; email: string; image: string | null };
    }[];
  };
  role: string;
};

export async function getCurrentManagement(): Promise<ManagementWithMembers | null> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { activeManagementId: true },
  });

  let membership;

  if (user?.activeManagementId) {
    membership = await prisma.managementMember.findFirst({
      where: { userId: session.user.id, managementId: user.activeManagementId },
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
  }

  if (!membership) {
    membership = await prisma.managementMember.findFirst({
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
  }

  if (membership && user?.activeManagementId !== membership.managementId) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { activeManagementId: membership.managementId },
    });
  }

  return membership;
}

export async function getUserManagements() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { activeManagementId: true },
  });

  const memberships = await prisma.managementMember.findMany({
    where: { userId: session.user.id },
    include: {
      management: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.management.id,
    name: m.management.name,
    role: m.role,
    memberCount: m.management._count.members,
    isActive: m.management.id === user?.activeManagementId,
  }));
}

export async function switchManagement(managementId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const membership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id, managementId },
  });
  if (!membership) throw new Error("Anda bukan anggota management ini");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { activeManagementId: managementId },
  });

  return { success: true, managementId };
}

export async function renameManagement(name: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { activeManagementId: true },
  });
  if (!user?.activeManagementId) throw new Error("Tidak ada management aktif");

  const membership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id, managementId: user.activeManagementId, role: "owner" },
  });
  if (!membership) throw new Error("Hanya pemilik yang bisa mengubah nama management");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nama tidak boleh kosong");

  await prisma.management.update({
    where: { id: user.activeManagementId },
    data: { name: trimmed },
  });

  return { success: true, name: trimmed };
}

export async function createManagement(name: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nama tidak boleh kosong");

  const management = await prisma.management.create({
    data: {
      name: trimmed,
      members: {
        create: { userId: session.user.id, role: "owner" },
      },
      categories: {
        create: DEFAULT_CATEGORIES.map((c) => ({ name: c.name, color: c.color, icon: c.icon })),
      },
    },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { activeManagementId: management.id },
  });

  return { success: true, managementId: management.id, name: management.name };
}

export async function createInvite() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { activeManagementId: true },
  });
  if (!user?.activeManagementId) throw new Error("Tidak ada management aktif");

  const membership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id, managementId: user.activeManagementId, role: "owner" },
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

  await prisma.$transaction(async (tx) => {
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

    await tx.user.update({
      where: { id: session.user.id },
      data: { activeManagementId: invitation.managementId },
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
