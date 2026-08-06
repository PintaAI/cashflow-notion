"use server";

import crypto from "crypto";
import { Prisma, type ManagementCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { putObject } from "@/lib/r2";
import { getBlobOptions } from "@/lib/blob";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { getSession, resolveManagementId } from "@/lib/management";
import { parseThemeColors, type GeneratedThemeColors } from "@/lib/theme-palettes";
import { isUniqueConstraintError } from "@/lib/api/client-id";

const MAX_MANAGEMENT_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MANAGEMENT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type ManagementWithMembers = {
  management: {
    id: string;
    name: string;
    category: ManagementCategory | null;
    image: string | null;
    imageTheme: GeneratedThemeColors | null;
    members: {
      id: string;
      role: string;
      user: { id: string; name: string | null; email: string; image: string | null };
    }[];
  };
  role: string;
};

export async function getCurrentManagement(managementId?: string): Promise<ManagementWithMembers | null> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { activeManagementId: true },
  });

  let membership;

  const requestedManagementId = managementId ?? user?.activeManagementId;

  if (requestedManagementId) {
    membership = await prisma.managementMember.findFirst({
      where: { userId: session.user.id, managementId: requestedManagementId },
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

  if (!membership) return null;

  return {
    ...membership,
    management: {
      ...membership.management,
      imageTheme: parseThemeColors(membership.management.imageTheme),
    },
  };
}

export async function getUserManagements(activeManagementId?: string) {
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
    category: m.management.category,
    image: m.management.image,
    imageTheme: parseThemeColors(m.management.imageTheme),
    role: m.role,
    memberCount: m.management._count.members,
    createdAt: m.management.createdAt.toISOString(),
    updatedAt: m.management.updatedAt.toISOString(),
    isActive: m.management.id === (activeManagementId ?? user?.activeManagementId),
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
  revalidatePath("/", "layout");

  return { success: true, managementId };
}

export async function renameManagement(name: string, managementId?: string, category?: ManagementCategory | null) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const targetManagementId = await resolveManagementId(managementId);

  const membership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id, managementId: targetManagementId, role: "owner" },
  });
  if (!membership) throw new Error("Hanya pemilik yang bisa mengubah nama management");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nama tidak boleh kosong");

  await prisma.management.update({
    where: { id: targetManagementId },
    data: { name: trimmed, ...(category !== undefined ? { category } : {}) },
  });
  revalidatePath("/", "layout");

  return { success: true, name: trimmed };
}

export type ManagementImageActionState = {
  status: "idle" | "success" | "error";
  message: string;
  management?: {
    id: string;
    image: string | null;
    imageTheme: GeneratedThemeColors | null;
  };
};

export async function updateManagementImage(
  _prevState: ManagementImageActionState,
  formData: FormData
): Promise<ManagementImageActionState> {
  const session = await getSession();
  if (!session) {
    return { status: "error", message: "Anda harus login terlebih dahulu." };
  }

  const rawManagementId = formData.get("managementId");
  const targetManagementId = await resolveManagementId(typeof rawManagementId === "string" ? rawManagementId : undefined);

  const membership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id, managementId: targetManagementId, role: "owner" },
  });
  if (!membership) {
    return { status: "error", message: "Hanya pemilik yang bisa mengubah foto dompet." };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Pilih foto dompet terlebih dahulu." };
  }

  if (!ALLOWED_MANAGEMENT_IMAGE_TYPES.has(file.type)) {
    return { status: "error", message: "Foto harus berupa JPG, PNG, WebP, atau GIF." };
  }

  if (file.size > MAX_MANAGEMENT_IMAGE_SIZE) {
    return { status: "error", message: "Ukuran foto maksimal 5 MB." };
  }

  const rawTheme = formData.get("theme");
  let imageTheme: GeneratedThemeColors | null = null;
  if (typeof rawTheme === "string") {
    try {
      imageTheme = parseThemeColors(JSON.parse(rawTheme));
    } catch {
      imageTheme = null;
    }
  }

  try {
    if (!getBlobOptions()) {
      return { status: "error", message: "Upload foto gagal. R2 storage belum dikonfigurasi." };
    }

    const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const buffer = Buffer.from(await file.arrayBuffer());
    const blob = await putObject(
      `managements/${targetManagementId}/${crypto.randomUUID()}.${extension}`,
      buffer,
      file.type,
    );

    const management = await prisma.management.update({
      where: { id: targetManagementId },
      data: {
        image: blob.pathname,
        imageTheme: imageTheme ?? Prisma.JsonNull,
      },
      select: { id: true, image: true, imageTheme: true },
    });

    revalidatePath("/", "layout");

    return {
      status: "success",
      message: imageTheme ? "Foto dan tema dompet tersimpan." : "Foto dompet tersimpan.",
      management: {
        id: management.id,
        image: management.image,
        imageTheme: parseThemeColors(management.imageTheme),
      },
    };
  } catch {
    return { status: "error", message: "Upload foto gagal. Pastikan R2 storage sudah dikonfigurasi." };
  }
}

export async function createManagement(name: string, clientId?: string, category?: ManagementCategory | null) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nama tidak boleh kosong");

  if (clientId) {
    const existing = await prisma.management.findFirst({
      where: { id: clientId, members: { some: { userId: session.user.id } } },
    });
    if (existing) return { success: true, managementId: existing.id, name: existing.name };
  }

  let management;
  try {
    management = await prisma.management.create({
      data: {
        ...(clientId ? { id: clientId } : {}),
        name: trimmed,
        category: category ?? null,
        members: {
          create: { userId: session.user.id, role: "owner" },
        },
        categories: {
          create: DEFAULT_CATEGORIES.map((c) => ({ name: c.name, color: c.color, icon: c.icon })),
        },
      },
    });
  } catch (error) {
    if (!clientId || !isUniqueConstraintError(error)) throw error;
    const existing = await prisma.management.findFirst({
      where: { id: clientId, members: { some: { userId: session.user.id } } },
    });
    if (!existing) throw error;
    management = existing;
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { activeManagementId: management.id },
  });

  return { success: true, managementId: management.id, name: management.name };
}

export async function deleteManagement(managementId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const ownerMembership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id, managementId, role: "owner" },
  });
  if (!ownerMembership) {
    const managementExists = await prisma.management.findUnique({
      where: { id: managementId },
      select: { id: true },
    });
    if (!managementExists) return { success: true };
    throw new Error("Hanya pemilik yang bisa menghapus dompet");
  }

  const memberUserIds = await prisma.managementMember.findMany({
    where: { managementId },
    select: { userId: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.management.deleteMany({ where: { id: managementId } });

    for (const member of memberUserIds) {
      const user = await tx.user.findUnique({
        where: { id: member.userId },
        select: { activeManagementId: true },
      });
      if (user?.activeManagementId !== managementId) continue;

      const nextMembership = await tx.managementMember.findFirst({
        where: { userId: member.userId },
        orderBy: { joinedAt: "asc" },
        select: { managementId: true },
      });

      await tx.user.update({
        where: { id: member.userId },
        data: { activeManagementId: nextMembership?.managementId ?? null },
      });
    }
  });

  revalidatePath("/", "layout");
  return { success: true };
}

export async function createInvite(managementId?: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const targetManagementId = await resolveManagementId(managementId);

  const membership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id, managementId: targetManagementId, role: "owner" },
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

export type ManagementInvitation = {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  expiresAt: string;
};

export async function getManagementInvitations(managementId?: string): Promise<ManagementInvitation[]> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const targetManagementId = await resolveManagementId(managementId);

  const membership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id, managementId: targetManagementId, role: "owner" },
  });
  if (!membership) throw new Error("Only management owner can view invites");

  const invitations = await prisma.invitation.findMany({
    where: { managementId: membership.managementId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      status: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  return invitations.map((invitation) => ({
    ...invitation,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
  }));
}

export async function deleteInvite(invitationId: string, managementId?: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const targetManagementId = await resolveManagementId(managementId);

  const membership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id, managementId: targetManagementId, role: "owner" },
  });
  if (!membership) throw new Error("Only management owner can delete invites");

  await prisma.invitation.deleteMany({
    where: { id: invitationId, managementId: membership.managementId },
  });

  return { success: true };
}

export async function removeManagementMember(memberId: string, managementId?: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const targetManagementId = await resolveManagementId(managementId);

  const ownerMembership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id, managementId: targetManagementId, role: "owner" },
  });
  if (!ownerMembership) throw new Error("Only management owner can remove members");

  const targetMember = await prisma.managementMember.findFirst({
    where: { id: memberId, managementId: ownerMembership.managementId },
    select: { id: true, userId: true, role: true, managementId: true },
  });
  if (!targetMember) throw new Error("Anggota tidak ditemukan");
  if (targetMember.role === "owner") throw new Error("Pemilik tidak bisa dihapus");

  await prisma.$transaction(async (tx) => {
    await tx.managementMember.delete({
      where: { id: targetMember.id },
    });

    const targetUser = await tx.user.findUnique({
      where: { id: targetMember.userId },
      select: { activeManagementId: true },
    });

    if (targetUser?.activeManagementId === targetMember.managementId) {
      const nextMembership = await tx.managementMember.findFirst({
        where: { userId: targetMember.userId },
        orderBy: { joinedAt: "asc" },
        select: { managementId: true },
      });

      await tx.user.update({
        where: { id: targetMember.userId },
        data: { activeManagementId: nextMembership?.managementId ?? null },
      });
    }
  });

  return { success: true };
}

type AcceptInviteResult =
  | { success: true }
  | { success: false; message: string };

export async function acceptInvite(code: string): Promise<AcceptInviteResult> {
  const session = await getSession();
  if (!session) return { success: false, message: "Anda harus masuk terlebih dahulu." };

  const normalizedCode = code.trim().toLowerCase();
  if (!normalizedCode) return { success: false, message: "Kode undangan tidak valid." };

  const invitation = await prisma.invitation.findUnique({
    where: { code: normalizedCode },
  });
  if (!invitation) return { success: false, message: "Undangan tidak ditemukan" };
  if (invitation.status !== "pending") return { success: false, message: "Undangan sudah digunakan" };
  if (invitation.expiresAt < new Date()) return { success: false, message: "Undangan sudah kadaluarsa" };

  const existingMember = await prisma.managementMember.findFirst({
    where: { managementId: invitation.managementId, userId: session.user.id },
  });
  if (existingMember) return { success: false, message: "Anda sudah menjadi anggota management ini" };

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

  return { success: true };
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
