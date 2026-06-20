"use server";

import crypto from "crypto";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { StatieRoundStatus, StatieRoomStatus, StatieVoteChoice } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ROOM_CODE_LENGTH = 6;
const PARTICIPANT_COOKIE_DAYS = 14;
const MIN_DEBATE_SECONDS = 30;
const MAX_DEBATE_SECONDS = 60 * 60;

type ActionResult<T> =
  | ({ success: true } & T)
  | { success: false; message: string };

function normalizeTopic(topic: string) {
  return topic.trim().replace(/\s+/g, " ").slice(0, 80);
}

function topicKey(topic: string) {
  return normalizeTopic(topic).toLowerCase();
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 32);
}

function normalizeRoomCode(code: string) {
  return code.trim().replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function clampDebateSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) return 120;
  return Math.min(MAX_DEBATE_SECONDS, Math.max(MIN_DEBATE_SECONDS, Math.round(seconds)));
}

function roomCookieName(code: string) {
  return `statie-room-${normalizeRoomCode(code).toLowerCase()}`;
}

async function getOptionalSession() {
  const hdrs = await headers();
  return auth.api.getSession({ headers: hdrs });
}

async function setParticipantCookie(code: string, token: string) {
  const store = await cookies();
  store.set(roomCookieName(code), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PARTICIPANT_COOKIE_DAYS * 24 * 60 * 60,
  });
}

async function getParticipantToken(code: string) {
  const store = await cookies();
  return store.get(roomCookieName(code))?.value ?? null;
}

async function generateUniqueRoomCode() {
  for (let i = 0; i < 8; i += 1) {
    const code = crypto.randomBytes(4).toString("base64url").replace(/[^a-z0-9]/gi, "").slice(0, ROOM_CODE_LENGTH).toUpperCase();
    const existing = await prisma.statieRoom.findUnique({ where: { code }, select: { id: true } });
    if (!existing && code.length === ROOM_CODE_LENGTH) return code;
  }

  throw new Error("Gagal membuat kode room unik.");
}

async function requireParticipant(code: string) {
  const roomCode = normalizeRoomCode(code);
  const token = await getParticipantToken(roomCode);
  if (!token) return null;

  const participant = await prisma.statieParticipant.findFirst({
    where: { room: { code: roomCode }, token },
    include: { room: true, user: { select: { name: true, email: true } } },
  });

  if (!participant) return null;

  await prisma.statieParticipant.update({
    where: { id: participant.id },
    data: { lastSeenAt: new Date() },
  });

  return participant;
}

async function requireLeader(code: string) {
  const participant = await requireParticipant(code);
  if (!participant || !participant.isLeader || participant.token !== participant.room.leaderToken) {
    throw new Error("Hanya leader yang bisa mengontrol room.");
  }
  return participant;
}

function participantDisplayName(participant: {
  guestName: string | null;
  user: { name: string | null; email: string } | null;
}) {
  return participant.user?.name || participant.user?.email.split("@")[0] || participant.guestName || "Guest";
}

async function getReusableOrGeneratedStatement(topic: string, usedStatementIds: string[]) {
  const key = topicKey(topic);
  const existing = await prisma.statieStatement.findMany({
    where: {
      topicKey: key,
      id: usedStatementIds.length ? { notIn: usedStatementIds } : undefined,
    },
    orderBy: [{ usedCount: "asc" }, { createdAt: "asc" }],
    take: 10,
  });

  if (existing.length > 0) {
    return existing[Math.floor(Math.random() * existing.length)];
  }

  const result = await generateText({
    model: google("gemini-2.5-flash-lite"),
    temperature: 0.9,
    prompt: `Buat satu pernyataan singkat untuk game sosial debat bernama Statie.

Topik: ${topic}

Syarat:
- Bahasa Indonesia.
- Hanya keluarkan satu kalimat pernyataan, tanpa bullet, tanpa tanda kutip.
- Pernyataan harus memancing opini "setuju" atau "tidak setuju".
- Jangan membuat ujaran kebencian, konten seksual eksplisit, instruksi kekerasan, atau menyerang kelompok identitas terlindungi.
- Panjang maksimal 140 karakter.`,
  });

  const text = result.text.trim().replace(/^['"]|['"]$/g, "").slice(0, 180);
  if (!text) throw new Error("AI gagal membuat statement.");

  return prisma.statieStatement.upsert({
    where: { topicKey_text: { topicKey: key, text } },
    create: { topic, topicKey: key, text, generatedByAi: true },
    update: {},
  });
}

export async function createStatieRoom(input: {
  topic: string;
  leaderName?: string;
  debateSeconds?: number;
}): Promise<ActionResult<{ code: string }>> {
  try {
    const topic = normalizeTopic(input.topic);
    if (!topic) return { success: false, message: "Topik tidak boleh kosong." };

    const session = await getOptionalSession();
    const leaderName = normalizeName(input.leaderName ?? "");
    if (!session && !leaderName) return { success: false, message: "Nama leader wajib diisi untuk guest." };

    const code = await generateUniqueRoomCode();
    const token = crypto.randomBytes(24).toString("base64url");
    const debateSeconds = clampDebateSeconds(input.debateSeconds ?? 120);

    await prisma.statieRoom.create({
      data: {
        code,
        topic,
        topicKey: topicKey(topic),
        leaderUserId: session?.user.id,
        leaderGuestName: session ? null : leaderName,
        leaderToken: token,
        debateSeconds,
        participants: {
          create: {
            userId: session?.user.id,
            guestName: session ? null : leaderName,
            token,
            isLeader: true,
          },
        },
      },
    });

    await setParticipantCookie(code, token);
    return { success: true, code };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal membuat room." };
  }
}

export async function joinStatieRoom(code: string, name?: string): Promise<ActionResult<{ code: string }>> {
  try {
    const roomCode = normalizeRoomCode(code);
    if (!roomCode) return { success: false, message: "Kode room tidak valid." };

    const room = await prisma.statieRoom.findUnique({ where: { code: roomCode }, select: { id: true, status: true } });
    if (!room) return { success: false, message: "Room tidak ditemukan." };
    if (room.status === StatieRoomStatus.Finished) return { success: false, message: "Room sudah selesai." };

    const session = await getOptionalSession();
    const guestName = normalizeName(name ?? "");
    if (!session && !guestName) return { success: false, message: "Nama wajib diisi untuk guest." };

    const existingToken = await getParticipantToken(roomCode);
    const existing = existingToken
      ? await prisma.statieParticipant.findFirst({ where: { roomId: room.id, token: existingToken } })
      : null;

    if (existing) {
      await prisma.statieParticipant.update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } });
      return { success: true, code: roomCode };
    }

    const token = crypto.randomBytes(24).toString("base64url");
    await prisma.statieParticipant.create({
      data: {
        roomId: room.id,
        userId: session?.user.id,
        guestName: session ? null : guestName,
        token,
      },
    });

    await setParticipantCookie(roomCode, token);
    revalidatePath(`/statie/${roomCode}`);
    return { success: true, code: roomCode };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal bergabung ke room." };
  }
}

export async function getStatieRoomState(code: string) {
  const roomCode = normalizeRoomCode(code);
  const participant = await requireParticipant(roomCode);

  const room = await prisma.statieRoom.findUnique({
    where: { code: roomCode },
    include: {
      participants: {
        include: { user: { select: { name: true, email: true, image: true } } },
        orderBy: [{ isLeader: "desc" }, { joinedAt: "asc" }],
      },
      rounds: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          statement: true,
          votes: { include: { participant: { include: { user: { select: { name: true, email: true } } } } } },
        },
      },
    },
  });

  if (!room) return null;
  const currentRound = room.rounds[0] ?? null;
  const currentParticipantVote = currentRound?.votes.find((vote) => vote.participantId === participant?.id)?.choice ?? null;

  return {
    code: room.code,
    topic: room.topic,
    status: room.status,
    debateSeconds: room.debateSeconds,
    isJoined: Boolean(participant),
    isLeader: Boolean(participant?.isLeader && participant.token === room.leaderToken),
    me: participant ? { id: participant.id, name: participantDisplayName(participant) } : null,
    participants: room.participants.map((item) => ({
      id: item.id,
      name: participantDisplayName(item),
      isLeader: item.isLeader,
      lastSeenAt: item.lastSeenAt.toISOString(),
    })),
    round: currentRound
      ? {
          id: currentRound.id,
          status: currentRound.status,
          statement: currentRound.statement.text,
          debateEndsAt: currentRound.debateEndsAt?.toISOString() ?? null,
          myVote: currentParticipantVote,
          votes: currentRound.votes.map((vote) => ({
            participantId: vote.participantId,
            participantName: participantDisplayName(vote.participant),
            choice: vote.choice,
          })),
        }
      : null,
  };
}

export async function startStatieRound(code: string): Promise<ActionResult<{ roundId: string }>> {
  try {
    const leader = await requireLeader(code);
    const activeRound = await prisma.statieRound.findFirst({
      where: { roomId: leader.roomId, status: { in: [StatieRoundStatus.Voting, StatieRoundStatus.Debate] } },
      select: { id: true },
    });
    if (activeRound) return { success: false, message: "Selesaikan ronde berjalan terlebih dahulu." };

    const usedRounds = await prisma.statieRound.findMany({
      where: { roomId: leader.roomId },
      select: { statementId: true },
    });
    const statement = await getReusableOrGeneratedStatement(leader.room.topic, usedRounds.map((round) => round.statementId));

    const round = await prisma.$transaction(async (tx) => {
      const createdRound = await tx.statieRound.create({
        data: { roomId: leader.roomId, statementId: statement.id, status: StatieRoundStatus.Voting },
      });

      await tx.statieStatement.update({ where: { id: statement.id }, data: { usedCount: { increment: 1 } } });
      await tx.statieRoom.update({
        where: { id: leader.roomId },
        data: { status: StatieRoomStatus.Voting, currentRoundId: createdRound.id },
      });

      return createdRound;
    });

    revalidatePath(`/statie/${leader.room.code}`);
    return { success: true, roundId: round.id };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal memulai ronde." };
  }
}

export async function submitStatieVote(code: string, choice: "Agree" | "Disagree"): Promise<ActionResult<object>> {
  try {
    const participant = await requireParticipant(code);
    if (!participant) return { success: false, message: "Bergabung ke room terlebih dahulu." };

    const round = await prisma.statieRound.findFirst({
      where: { roomId: participant.roomId, status: StatieRoundStatus.Voting },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!round) return { success: false, message: "Belum ada voting aktif." };

    await prisma.statieVote.upsert({
      where: { roundId_participantId: { roundId: round.id, participantId: participant.id } },
      create: { roundId: round.id, participantId: participant.id, choice: StatieVoteChoice[choice] },
      update: { choice: StatieVoteChoice[choice] },
    });

    revalidatePath(`/statie/${participant.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menyimpan vote." };
  }
}

export async function startStatieDebate(code: string): Promise<ActionResult<object>> {
  try {
    const leader = await requireLeader(code);
    const round = await prisma.statieRound.findFirst({
      where: { roomId: leader.roomId, status: StatieRoundStatus.Voting },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!round) return { success: false, message: "Belum ada ronde voting aktif." };

    const now = new Date();
    const debateEndsAt = new Date(now.getTime() + leader.room.debateSeconds * 1000);

    await prisma.$transaction([
      prisma.statieRound.update({
        where: { id: round.id },
        data: { status: StatieRoundStatus.Debate, debateStartedAt: now, debateEndsAt },
      }),
      prisma.statieRoom.update({ where: { id: leader.roomId }, data: { status: StatieRoomStatus.Debate } }),
    ]);

    revalidatePath(`/statie/${leader.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal memulai debat." };
  }
}

export async function finishStatieRound(code: string): Promise<ActionResult<object>> {
  try {
    const leader = await requireLeader(code);
    const round = await prisma.statieRound.findFirst({
      where: { roomId: leader.roomId, status: { in: [StatieRoundStatus.Voting, StatieRoundStatus.Debate] } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!round) return { success: false, message: "Tidak ada ronde aktif." };

    await prisma.$transaction([
      prisma.statieRound.update({ where: { id: round.id }, data: { status: StatieRoundStatus.Finished, finishedAt: new Date() } }),
      prisma.statieRoom.update({ where: { id: leader.roomId }, data: { status: StatieRoomStatus.Lobby, currentRoundId: null } }),
    ]);

    revalidatePath(`/statie/${leader.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menyelesaikan ronde." };
  }
}
