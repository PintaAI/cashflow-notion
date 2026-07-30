"use server";

import { prisma } from "@/lib/db";
import { requireAdmin, isCurrentUserAdmin } from "@/lib/admin";

export async function checkAdminStatus() {
  return isCurrentUserAdmin();
}

export async function getAdminDashboard() {
  await requireAdmin();

  const [
    userCount,
    managementCount,
    entryAgg,
    totalEntries,
    recentUsers,
    recentManagements,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.management.count(),
    prisma.entry.aggregate({
      _sum: { nominal: true },
    }),
    prisma.entry.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    }),
    prisma.management.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        _count: { select: { members: true, entries: true } },
        members: {
          where: { role: "owner" },
          include: { user: { select: { name: true, email: true } } },
          take: 1,
        },
      },
    }),
  ]);

  const totalIncome = await prisma.entry.aggregate({
    _sum: { nominal: true },
    where: { io: "Income" },
  });
  const totalExpenses = await prisma.entry.aggregate({
    _sum: { nominal: true },
    where: { io: "Expenses" },
  });

  return {
    stats: {
      userCount,
      managementCount,
      totalEntries,
      totalIncome: totalIncome._sum.nominal ?? 0,
      totalExpenses: totalExpenses._sum.nominal ?? 0,
      totalNominal: entryAgg._sum.nominal ?? 0,
    },
    recentUsers,
    recentManagements: recentManagements.map((m) => ({
      id: m.id,
      name: m.name,
      createdAt: m.createdAt.toISOString(),
      memberCount: m._count.members,
      entryCount: m._count.entries,
      owner: m.members[0]?.user ?? null,
    })),
  };
}

export async function getAllUsers() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      memberships: {
        include: {
          management: { select: { id: true, name: true } },
        },
      },
      _count: { select: { memberships: true } },
    },
  });

  const entryCounts = await prisma.entry.groupBy({
    by: ["managementId"],
    _count: { _all: true },
  });
  const countByManagement = new Map(
    entryCounts.map((e) => [e.managementId, e._count._all])
  );

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    createdAt: user.createdAt.toISOString(),
    managementCount: user._count.memberships,
    memberships: user.memberships.map((m) => ({
      id: m.id,
      managementId: m.managementId,
      managementName: m.management.name,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      entryCount: countByManagement.get(m.managementId) ?? 0,
    })),
  }));
}

export async function getAllManagements() {
  await requireAdmin();

  const managements = await prisma.management.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true, entries: true, categories: true, quickFills: true } },
      members: {
        where: { role: "owner" },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        take: 1,
      },
    },
  });

  const lastEntryDates = await prisma.entry.groupBy({
    by: ["managementId"],
    _max: { date: true },
  });
  const lastActivity = new Map(
    lastEntryDates.map((e) => [e.managementId, e._max.date])
  );

  return managements.map((m) => ({
    id: m.id,
    name: m.name,
    createdAt: m.createdAt.toISOString(),
    memberCount: m._count.members,
    entryCount: m._count.entries,
    categoryCount: m._count.categories,
    quickFillCount: m._count.quickFills,
    owner: m.members[0]?.user ?? null,
    lastActivity: lastActivity.get(m.id) ?? null,
  }));
}

export async function getManagementDetails(managementId: string) {
  await requireAdmin();

  const management = await prisma.management.findUnique({
    where: { id: managementId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, image: true, createdAt: true } } },
        orderBy: { joinedAt: "asc" },
      },
      _count: { select: { entries: true, categories: true, quickFills: true, invitations: true } },
    },
  });
  if (!management) throw new Error("Management not found");

  const [entryAgg, incomeAgg, expensesAgg] = await Promise.all([
    prisma.entry.aggregate({
      _sum: { nominal: true },
      where: { managementId },
    }),
    prisma.entry.aggregate({
      _sum: { nominal: true },
      where: { managementId, io: "Income" },
    }),
    prisma.entry.aggregate({
      _sum: { nominal: true },
      where: { managementId, io: "Expenses" },
    }),
  ]);

  const totalEntries = management._count.entries;

  return {
    id: management.id,
    name: management.name,
    createdAt: management.createdAt.toISOString(),
    _count: management._count,
    totalNominal: entryAgg._sum.nominal ?? 0,
    totalIncome: incomeAgg._sum.nominal ?? 0,
    totalExpenses: expensesAgg._sum.nominal ?? 0,
    totalEntries,
    members: management.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      user: m.user,
    })),
  };
}

export async function updateMemberRole(memberId: string, role: string) {
  await requireAdmin();

  if (role !== "owner" && role !== "member") {
    throw new Error("Invalid role");
  }

  const member = await prisma.managementMember.findUnique({
    where: { id: memberId },
  });
  if (!member) throw new Error("Member not found");

  await prisma.managementMember.update({
    where: { id: memberId },
    data: { role },
  });

  return { success: true };
}

export async function removeMember(memberId: string) {
  await requireAdmin();

  const member = await prisma.managementMember.findUnique({
    where: { id: memberId },
  });
  if (!member) throw new Error("Member not found");

  await prisma.managementMember.delete({ where: { id: memberId } });
  return { success: true };
}

export async function deleteManagement(managementId: string) {
  await requireAdmin();

  const management = await prisma.management.findUnique({
    where: { id: managementId },
  });
  if (!management) throw new Error("Management not found");

  await prisma.management.delete({ where: { id: managementId } });
  return { success: true };
}

export async function deleteUser(userId: string) {
  await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { select: { managementId: true } } },
  });
  if (!user) throw new Error("User not found");

  const managementIds = user.memberships.map((m) => m.managementId);

  await prisma.$transaction(async (tx) => {
    for (const managementId of managementIds) {
      const remainingMembers = await tx.managementMember.count({
        where: { managementId, userId: { not: userId } },
      });
      if (remainingMembers === 0) {
        await tx.management.delete({ where: { id: managementId } });
      }
    }
    await tx.user.delete({ where: { id: userId } });
  });

  return { success: true };
}

export async function transferOwnership(managementId: string, newOwnerUserId: string) {
  await requireAdmin();

  const membership = await prisma.managementMember.findFirst({
    where: { managementId, userId: newOwnerUserId },
  });
  if (!membership) throw new Error("User is not a member of this management");

  const currentOwner = await prisma.managementMember.findFirst({
    where: { managementId, role: "owner" },
  });

  await prisma.$transaction(async (tx) => {
    if (currentOwner && currentOwner.userId !== newOwnerUserId) {
      await tx.managementMember.update({
        where: { id: currentOwner.id },
        data: { role: "member" },
      });
    }
    await tx.managementMember.update({
      where: { id: membership.id },
      data: { role: "owner" },
    });
  });

  return { success: true };
}

export async function createManagement(name: string, ownerEmail?: string) {
  await requireAdmin();

  let ownerId: string | undefined;

  if (ownerEmail) {
    const user = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (!user) throw new Error("User not found");
    ownerId = user.id;
  }

  const management = await prisma.management.create({
    data: {
      name,
      ...(ownerId
        ? {
            members: {
              create: { userId: ownerId, role: "owner" },
            },
          }
        : {}),
    },
  });

  return { id: management.id, name: management.name };
}

export async function addUserToManagement(userId: string, managementId: string, role: string = "member") {
  await requireAdmin();

  const existing = await prisma.managementMember.findUnique({
    where: { managementId_userId: { managementId, userId } },
  });
  if (existing) throw new Error("User is already a member");

  const member = await prisma.managementMember.create({
    data: { managementId, userId, role },
  });

  return { id: member.id, role: member.role };
}
