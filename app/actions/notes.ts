"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/management";

const NOTE_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type UserNote = {
  id: string;
  title: string;
  contentJson: string | null;
  contentHtml: string | null;
  contentMarkdown: string | null;
  role: string;
  memberCount: number;
  updatedAt: string;
  members: {
    id: string;
    role: string;
    user: { id: string; name: string | null; email: string; image: string | null };
  }[];
};

export type NoteInvitationInfo = {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  expiresAt: string;
};

async function getNoteMembership(noteId: string, userId: string) {
  return prisma.noteMember.findFirst({
    where: { noteId, userId },
    select: { id: true, role: true, noteId: true },
  });
}

export async function getUserNotes(): Promise<UserNote[]> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const memberships = await prisma.noteMember.findMany({
    where: { userId: session.user.id },
    include: {
      note: {
        include: {
          _count: { select: { members: true } },
          members: {
            orderBy: { joinedAt: "asc" },
            include: { user: { select: { id: true, name: true, email: true, image: true } } },
          },
        },
      },
    },
    orderBy: { note: { updatedAt: "desc" } },
  });

  return memberships.map((membership) => ({
    id: membership.note.id,
    title: membership.note.title,
    contentJson: membership.note.contentJson,
    contentHtml: membership.note.contentHtml,
    contentMarkdown: membership.note.contentMarkdown,
    role: membership.role,
    memberCount: membership.note._count.members,
    updatedAt: membership.note.updatedAt.toISOString(),
    members: membership.note.members.map((member) => ({
      id: member.id,
      role: member.role,
      user: member.user,
    })),
  }));
}

export async function createNote(title: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const trimmed = title.trim() || "Untitled note";
  const note = await prisma.note.create({
    data: {
      title: trimmed,
      members: {
        create: { userId: session.user.id, role: "owner" },
      },
    },
    select: { id: true },
  });

  revalidatePath("/notes");
  return { success: true, noteId: note.id };
}

export async function updateNoteTitle(noteId: string, title: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const membership = await getNoteMembership(noteId, session.user.id);
  if (!membership) throw new Error("Anda bukan anggota catatan ini");

  const trimmed = title.trim();
  if (!trimmed) throw new Error("Judul catatan tidak boleh kosong");

  await prisma.note.update({
    where: { id: noteId },
    data: { title: trimmed },
  });

  revalidatePath("/notes");
  return { success: true };
}

export async function updateNoteContent(
  noteId: string,
  content: { contentJson: string; html: string; markdown: string }
) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const membership = await getNoteMembership(noteId, session.user.id);
  if (!membership) throw new Error("Anda bukan anggota catatan ini");

  await prisma.note.update({
    where: { id: noteId },
    data: {
      contentJson: content.contentJson,
      contentHtml: content.html,
      contentMarkdown: content.markdown,
    },
  });

  revalidatePath("/notes");
  return { success: true };
}

export async function deleteNote(noteId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const membership = await getNoteMembership(noteId, session.user.id);
  if (!membership || membership.role !== "owner") throw new Error("Hanya pemilik yang bisa menghapus catatan");

  await prisma.note.delete({ where: { id: noteId } });
  revalidatePath("/notes");
  return { success: true };
}

export async function createNoteInvite(noteId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const membership = await getNoteMembership(noteId, session.user.id);
  if (!membership || membership.role !== "owner") throw new Error("Hanya pemilik yang bisa membuat undangan");

  const code = crypto.randomBytes(4).toString("hex");
  const expiresAt = new Date(Date.now() + NOTE_INVITE_TTL_MS);

  await prisma.noteInvitation.create({
    data: { noteId, code, expiresAt },
  });

  revalidatePath("/notes");
  return code;
}

export async function getNoteInvitations(noteId: string): Promise<NoteInvitationInfo[]> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const membership = await getNoteMembership(noteId, session.user.id);
  if (!membership || membership.role !== "owner") throw new Error("Hanya pemilik yang bisa melihat undangan");

  const invitations = await prisma.noteInvitation.findMany({
    where: { noteId },
    orderBy: { createdAt: "desc" },
  });

  return invitations.map((invitation) => ({
    id: invitation.id,
    code: invitation.code,
    status: invitation.status,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
  }));
}

export async function deleteNoteInvite(noteId: string, invitationId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const membership = await getNoteMembership(noteId, session.user.id);
  if (!membership || membership.role !== "owner") throw new Error("Hanya pemilik yang bisa menghapus undangan");

  await prisma.noteInvitation.deleteMany({ where: { id: invitationId, noteId } });
  revalidatePath("/notes");
  return { success: true };
}

type AcceptNoteInviteResult =
  | { success: true }
  | { success: false; message: string };

export async function acceptNoteInvite(code: string): Promise<AcceptNoteInviteResult> {
  const session = await getSession();
  if (!session) return { success: false, message: "Anda harus masuk terlebih dahulu." };

  const normalizedCode = code.trim().toLowerCase();
  if (!normalizedCode) return { success: false, message: "Kode undangan tidak valid." };

  const invitation = await prisma.noteInvitation.findUnique({ where: { code: normalizedCode } });
  if (!invitation) return { success: false, message: "Undangan catatan tidak ditemukan" };
  if (invitation.status !== "pending") return { success: false, message: "Undangan sudah digunakan" };
  if (invitation.expiresAt < new Date()) return { success: false, message: "Undangan sudah kadaluarsa" };

  const existingMember = await prisma.noteMember.findFirst({
    where: { noteId: invitation.noteId, userId: session.user.id },
  });
  if (existingMember) return { success: false, message: "Anda sudah menjadi anggota catatan ini" };

  await prisma.$transaction(async (tx) => {
    await tx.noteMember.create({
      data: { noteId: invitation.noteId, userId: session.user.id, role: "member" },
    });

    await tx.noteInvitation.update({
      where: { id: invitation.id },
      data: { status: "accepted" },
    });
  });

  revalidatePath("/notes");
  return { success: true };
}

export async function getUserNote(noteId: string): Promise<UserNote | null> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const membership = await prisma.noteMember.findFirst({
    where: { noteId, userId: session.user.id },
    include: {
      note: {
        include: {
          _count: { select: { members: true } },
          members: {
            orderBy: { joinedAt: "asc" },
            include: { user: { select: { id: true, name: true, email: true, image: true } } },
          },
        },
      },
    },
  });
  if (!membership) return null;

  return {
    id: membership.note.id,
    title: membership.note.title,
    contentJson: membership.note.contentJson,
    contentHtml: membership.note.contentHtml,
    contentMarkdown: membership.note.contentMarkdown,
    role: membership.role,
    memberCount: membership.note._count.members,
    updatedAt: membership.note.updatedAt.toISOString(),
    members: membership.note.members.map((member) => ({
      id: member.id,
      role: member.role,
      user: member.user,
    })),
  };
}
