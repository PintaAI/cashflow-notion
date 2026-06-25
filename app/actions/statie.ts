"use server";

import crypto from "crypto";
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { StatieRoundStatus, StatieRoomStatus, StatieVoteChoice } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

const ROOM_CODE_LENGTH = 6;
const PARTICIPANT_COOKIE_DAYS = 14;
const MIN_DEBATE_SECONDS = 30;
const MAX_DEBATE_SECONDS = 15 * 60;
const VOTING_SECONDS = 30;
const MIN_PLAYER_LIMIT = 2;
const MAX_PLAYER_LIMIT = 30;
const ROOM_CLEANUP_MS = 24 * 60 * 60 * 1000;

const statieScoreSchema = z.object({
  participants: z.array(z.object({
    participantId: z.string(),
    score: z.number().min(0).max(100),
    reason: z.string(),
    criteria: z.object({
      clarity: z.number().min(0).max(20),
      logic: z.number().min(0).max(25),
      evidence: z.number().min(0).max(15),
      rebuttal: z.number().min(0).max(20),
      sportsmanship: z.number().min(0).max(20),
    }),
  })),
  winnerParticipantId: z.string().nullable(),
  summary: z.string(),
});

type ActionResult<T> =
  | ({ success: true } & T)
  | { success: false; message: string };

function normalizeTopic(topic: string) {
  return topic.trim().replace(/\s+/g, " ").slice(0, 80);
}

function topicKey(topic: string) {
  return normalizeTopic(topic).toLowerCase();
}

function parseTopics(topicInput: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of topicInput.split(",")) {
    const normalized = normalizeTopic(raw);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= 10) break;
  }
  return result;
}

function serializeTopics(topics: string[]): string {
  return topics.join(", ");
}

function topicsKey(topics: string[]): string {
  return topics.map((topic) => topic.toLowerCase()).join(",");
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 32);
}

function normalizeStatementText(text: string) {
  return text.trim().replace(/\s+/g, " ").slice(0, 180);
}

function normalizeRoomCode(code: string) {
  return code.trim().replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function clampDebateSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) return 900;
  return Math.min(MAX_DEBATE_SECONDS, Math.max(MIN_DEBATE_SECONDS, Math.round(seconds)));
}

function clampPlayerLimit(limit: number) {
  if (!Number.isFinite(limit)) return 10;
  return Math.min(MAX_PLAYER_LIMIT, Math.max(MIN_PLAYER_LIMIT, Math.round(limit)));
}

function getVotingEndsAt(votingStartedAt: Date) {
  return new Date(votingStartedAt.getTime() + VOTING_SECONDS * 1000);
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

async function startDebateWithRandomMissingVotes(input: {
  roomId: string;
  roundId: string;
  debateSeconds: number;
}) {
  const now = new Date();
  const debateEndsAt = new Date(now.getTime() + input.debateSeconds * 1000);

  await prisma.$transaction(async (tx) => {
    const activeRound = await tx.statieRound.findFirst({
      where: { id: input.roundId, status: StatieRoundStatus.Voting },
      select: { id: true },
    });
    if (!activeRound) return;

    const [participants, votes] = await Promise.all([
      tx.statieParticipant.findMany({ where: { roomId: input.roomId }, select: { id: true } }),
      tx.statieVote.findMany({ where: { roundId: input.roundId }, select: { participantId: true } }),
    ]);
    const votedParticipantIds = new Set(votes.map((vote) => vote.participantId));
    const randomVotes = participants
      .filter((participant) => !votedParticipantIds.has(participant.id))
      .map((participant) => ({
        roundId: input.roundId,
        participantId: participant.id,
        choice: Math.random() < 0.5 ? StatieVoteChoice.Agree : StatieVoteChoice.Disagree,
      }));

    if (randomVotes.length > 0) {
      await tx.statieVote.createMany({ data: randomVotes, skipDuplicates: true });
    }

    await tx.statieRound.update({
      where: { id: input.roundId },
      data: { status: StatieRoundStatus.Debate, debateStartedAt: now, debateEndsAt },
    });
    await tx.statieRoom.update({ where: { id: input.roomId }, data: { status: StatieRoomStatus.Debate } });
  });
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

async function scoreStatieRound(roundId: string) {
  const round = await prisma.statieRound.findUnique({
    where: { id: roundId },
    include: {
      statement: true,
      transcripts: {
        include: {
          participant: { include: { user: { select: { name: true, email: true } } } },
        },
      },
      votes: true,
    },
  });

  if (!round || round.transcripts.length === 0) return;

  const voteByParticipantId = new Map(round.votes.map((vote) => [vote.participantId, vote.choice]));
  const transcriptLines = round.transcripts.map((transcript) => {
    const side = voteByParticipantId.get(transcript.participantId) ?? "Unknown";
    return [
      `Participant ID: ${transcript.participantId}`,
      `Name: ${participantDisplayName(transcript.participant)}`,
      `Side: ${side}`,
      `Transcript: ${transcript.text}`,
    ].join("\n");
  }).join("\n\n---\n\n");

  const result = await generateText({
    model: google("gemini-2.5-flash-lite"),
    temperature: 0.2,
    output: Output.object({
      name: "StatieDebateScore",
      description: "AI judging result for a casual debate game round.",
      schema: statieScoreSchema,
    }),
    prompt: `Nilai debat game Statie berikut dalam Bahasa Indonesia.

Pernyataan debat: ${round.statement.text}

Aturan scoring:
- Skor total 0-100 per peserta.
- clarity maksimal 20, logic maksimal 25, evidence maksimal 15, rebuttal maksimal 20, sportsmanship maksimal 20.
- Jangan beri skor tinggi untuk argumen kosong, hinaan personal, atau transcript yang tidak relevan.
- Pilih winnerParticipantId dari participantId yang tersedia, atau null jika semua transcript terlalu lemah.
- Reason singkat, spesifik, dan aman untuk ditampilkan ke pemain.

Transcript peserta:

${transcriptLines}`,
  });

  await prisma.statieRound.update({
    where: { id: roundId },
    data: { aiScore: result.output, aiScoreError: null, aiScoredAt: new Date() },
  });
}

export async function createStatieRoom(input: {
  topic: string;
  leaderName?: string;
  debateSeconds?: number;
  statementId?: string;
}): Promise<ActionResult<{ code: string }>> {
  try {
    const topics = parseTopics(input.topic || "random");
    const topic = serializeTopics(topics);
    const roomTopicsKey = topicsKey(topics);

    const session = await getOptionalSession();
    const leaderName = normalizeName(input.leaderName ?? "");
    if (!session && !leaderName) return { success: false, message: "Nama leader wajib diisi untuk guest." };

    let pendingStatementId: string | null = null;
    if (input.statementId) {
      const statement = await prisma.statieStatement.findUnique({
        where: { id: input.statementId },
        select: { id: true, topicKey: true },
      });
      const roomTopicKeys = new Set(topics.map((t) => t.toLowerCase()));
      if (statement && roomTopicKeys.has(statement.topicKey)) {
        pendingStatementId = statement.id;
      }
    }

    const code = await generateUniqueRoomCode();
    const token = crypto.randomBytes(24).toString("base64url");
    const debateSeconds = clampDebateSeconds(input.debateSeconds ?? 900);

    await prisma.statieRoom.create({
      data: {
        code,
        topic,
        topicKey: roomTopicsKey,
        leaderUserId: session?.user.id,
        leaderGuestName: session ? null : leaderName,
        leaderToken: token,
        debateSeconds,
        pendingStatementId,
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

    const room = await prisma.statieRoom.findUnique({ where: { code: roomCode }, select: { id: true, status: true, playerLimit: true, _count: { select: { participants: true } } } });
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

    if (room._count.participants >= room.playerLimit) return { success: false, message: "Room sudah penuh." };

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

  let room = await prisma.statieRoom.findUnique({
    where: { code: roomCode },
    include: {
      participants: {
        include: { user: { select: { name: true, email: true, image: true } } },
        orderBy: [{ isLeader: "desc" }, { joinedAt: "asc" }],
      },
      rounds: {
        where: { status: { in: [StatieRoundStatus.Voting, StatieRoundStatus.Debate] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          statement: true,
          transcripts: true,
          votes: { include: { participant: { include: { user: { select: { name: true, email: true } } } } } },
        },
      },
    },
  });

  if (!room) return null;
  let currentRound = room.rounds[0] ?? null;

  if (currentRound?.status === StatieRoundStatus.Voting && Date.now() >= getVotingEndsAt(currentRound.votingStartedAt).getTime()) {
    await startDebateWithRandomMissingVotes({
      roomId: room.id,
      roundId: currentRound.id,
      debateSeconds: room.debateSeconds,
    });

    room = await prisma.statieRoom.findUnique({
      where: { code: roomCode },
      include: {
        participants: {
          include: { user: { select: { name: true, email: true, image: true } } },
          orderBy: [{ isLeader: "desc" }, { joinedAt: "asc" }],
        },
        rounds: {
          where: { status: { in: [StatieRoundStatus.Voting, StatieRoundStatus.Debate] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            statement: true,
            transcripts: true,
            votes: { include: { participant: { include: { user: { select: { name: true, email: true } } } } } },
          },
        },
      },
    });
    if (!room) return null;
    currentRound = room.rounds[0] ?? null;
  }

  const currentParticipantVote = currentRound?.votes.find((vote) => vote.participantId === participant?.id)?.choice ?? null;
  const lastFinishedRound = currentRound
    ? null
    : await prisma.statieRound.findFirst({
        where: { roomId: room.id, status: StatieRoundStatus.Finished },
        orderBy: { finishedAt: "desc" },
        include: {
          statement: true,
          transcripts: true,
          votes: { include: { participant: { include: { user: { select: { name: true, email: true } } } } } },
        },
      });

  return {
    code: room.code,
    topic: room.topic,
    status: room.status,
    debateSeconds: room.debateSeconds,
    playerLimit: room.playerLimit,
    hasPendingStatement: Boolean(room.pendingStatementId),
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
          votingEndsAt: getVotingEndsAt(currentRound.votingStartedAt).toISOString(),
          debateEndsAt: currentRound.debateEndsAt?.toISOString() ?? null,
          myVote: currentParticipantVote,
          myTranscript: currentRound.transcripts.find((transcript) => transcript.participantId === participant?.id)?.text ?? null,
          transcriptCount: currentRound.transcripts.length,
          aiScore: currentRound.aiScore,
          aiScoreError: currentRound.aiScoreError,
          aiScoredAt: currentRound.aiScoredAt?.toISOString() ?? null,
          votes: currentRound.votes.map((vote) => ({
            participantId: vote.participantId,
            participantName: participantDisplayName(vote.participant),
            choice: vote.choice,
          })),
        }
      : null,
    lastResult: lastFinishedRound
      ? {
          id: lastFinishedRound.id,
          statement: lastFinishedRound.statement.text,
          transcriptCount: lastFinishedRound.transcripts.length,
          aiScore: lastFinishedRound.aiScore,
          aiScoreError: lastFinishedRound.aiScoreError,
          aiScoredAt: lastFinishedRound.aiScoredAt?.toISOString() ?? null,
          votes: lastFinishedRound.votes.map((vote) => ({
            participantId: vote.participantId,
            participantName: participantDisplayName(vote.participant),
            choice: vote.choice,
          })),
        }
      : null,
  };
}

export async function startStatieRound(code: string, customStatement?: string): Promise<ActionResult<{ roundId: string }>> {
  try {
    const leader = await requireLeader(code);
    const activeRound = await prisma.statieRound.findFirst({
      where: { roomId: leader.roomId, status: { in: [StatieRoundStatus.Voting, StatieRoundStatus.Debate] } },
      select: { id: true },
    });
    if (activeRound) return { success: false, message: "Selesaikan ronde berjalan terlebih dahulu." };

    let statement: { id: string };

    const roomTopics = parseTopics(leader.room.topic);
    const activeTopic = roomTopics.length > 0
      ? roomTopics[Math.floor(Math.random() * roomTopics.length)]
      : leader.room.topic;
    const activeTopicKey = topicKey(activeTopic);

    const customText = normalizeStatementText(customStatement ?? "");
    if (customText) {
      statement = await prisma.statieStatement.upsert({
        where: { topicKey_text: { topicKey: activeTopicKey, text: customText } },
        create: { topic: activeTopic, topicKey: activeTopicKey, text: customText, generatedByAi: false },
        update: {},
      });
    } else if (leader.room.pendingStatementId) {
      const pending = await prisma.statieStatement.findUnique({
        where: { id: leader.room.pendingStatementId },
        select: { id: true },
      });
      if (!pending) throw new Error("Statement tersimpan tidak ditemukan.");
      statement = pending;
    } else {
      const usedRounds = await prisma.statieRound.findMany({
        where: { roomId: leader.roomId },
        select: { statementId: true },
      });
      statement = await getReusableOrGeneratedStatement(activeTopic, usedRounds.map((round) => round.statementId));
    }

    const round = await prisma.$transaction(async (tx) => {
      const createdRound = await tx.statieRound.create({
        data: { roomId: leader.roomId, statementId: statement.id, status: StatieRoundStatus.Voting },
      });

      await tx.statieStatement.update({ where: { id: statement.id }, data: { usedCount: { increment: 1 } } });
      await tx.statieRoom.update({
        where: { id: leader.roomId },
        data: { status: StatieRoomStatus.Voting, currentRoundId: createdRound.id, pendingStatementId: null },
      });

      return createdRound;
    });

    revalidatePath(`/statie/${leader.room.code}`);
    return { success: true, roundId: round.id };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal memulai ronde." };
  }
}

export async function updateStatieRoomTopic(code: string, topicInput: string): Promise<ActionResult<object>> {
  try {
    const leader = await requireLeader(code);
    const topics = parseTopics(topicInput);
    if (topics.length === 0) return { success: false, message: "Topik tidak boleh kosong." };
    const topic = serializeTopics(topics);

    const activeRound = await prisma.statieRound.findFirst({
      where: { roomId: leader.roomId, status: { in: [StatieRoundStatus.Voting, StatieRoundStatus.Debate] } },
      select: { id: true },
    });
    if (activeRound) return { success: false, message: "Topik hanya bisa diganti saat tidak ada ronde aktif." };

    await prisma.statieRoom.update({
      where: { id: leader.roomId },
      data: { topic, topicKey: topicsKey(topics) },
    });

    revalidatePath(`/statie/${leader.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal mengganti topik." };
  }
}

export async function updateStatiePlayerLimit(code: string, limitInput: number): Promise<ActionResult<object>> {
  try {
    const leader = await requireLeader(code);
    const playerLimit = clampPlayerLimit(limitInput);
    const currentCount = await prisma.statieParticipant.count({ where: { roomId: leader.roomId } });

    if (playerLimit < currentCount) {
      return { success: false, message: `Limit minimal ${currentCount} karena sudah ada ${currentCount} pemain.` };
    }

    await prisma.statieRoom.update({ where: { id: leader.roomId }, data: { playerLimit } });

    revalidatePath(`/statie/${leader.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal mengganti limit pemain." };
  }
}

export async function kickStatieParticipant(code: string, participantId: string): Promise<ActionResult<object>> {
  try {
    const leader = await requireLeader(code);
    const participant = await prisma.statieParticipant.findFirst({
      where: { id: participantId, roomId: leader.roomId },
      select: { id: true, isLeader: true },
    });

    if (!participant) return { success: false, message: "Pemain tidak ditemukan." };
    if (participant.isLeader) return { success: false, message: "Leader tidak bisa dikeluarkan." };

    await prisma.statieParticipant.delete({ where: { id: participant.id } });

    revalidatePath(`/statie/${leader.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal mengeluarkan pemain." };
  }
}

export async function submitStatieVote(code: string, choice: "Agree" | "Disagree"): Promise<ActionResult<object>> {
  try {
    const participant = await requireParticipant(code);
    if (!participant) return { success: false, message: "Bergabung ke room terlebih dahulu." };

    const round = await prisma.statieRound.findFirst({
      where: { roomId: participant.roomId, status: StatieRoundStatus.Voting },
      orderBy: { createdAt: "desc" },
      select: { id: true, votingStartedAt: true },
    });
    if (!round) return { success: false, message: "Belum ada voting aktif." };

    if (Date.now() >= getVotingEndsAt(round.votingStartedAt).getTime()) {
      await startDebateWithRandomMissingVotes({
        roomId: participant.roomId,
        roundId: round.id,
        debateSeconds: participant.room.debateSeconds,
      });
      revalidatePath(`/statie/${participant.room.code}`);
      return { success: true };
    }

    await prisma.statieVote.upsert({
      where: { roundId_participantId: { roundId: round.id, participantId: participant.id } },
      create: { roundId: round.id, participantId: participant.id, choice: StatieVoteChoice[choice] },
      update: { choice: StatieVoteChoice[choice] },
    });

    const [voteCount, participantCount] = await Promise.all([
      prisma.statieVote.count({ where: { roundId: round.id } }),
      prisma.statieParticipant.count({ where: { roomId: participant.roomId } }),
    ]);

    if (voteCount >= participantCount) {
      await startDebateWithRandomMissingVotes({
        roomId: participant.roomId,
        roundId: round.id,
        debateSeconds: participant.room.debateSeconds,
      });
    }

    revalidatePath(`/statie/${participant.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menyimpan vote." };
  }
}

export async function submitStatieTranscript(code: string, roundId: string, text: string): Promise<ActionResult<object>> {
  try {
    const participant = await requireParticipant(code);
    if (!participant) return { success: false, message: "Bergabung ke room terlebih dahulu." };

    const normalizedText = text.trim().replace(/\s+/g, " ").slice(0, 12_000);
    if (!normalizedText) return { success: false, message: "Transcript kosong." };

    const round = await prisma.statieRound.findFirst({
      where: { id: roundId, roomId: participant.roomId, status: { in: [StatieRoundStatus.Debate, StatieRoundStatus.Finished] } },
      select: { id: true },
    });
    if (!round) return { success: false, message: "Ronde debat tidak ditemukan." };

    await prisma.statieTranscript.upsert({
      where: { roundId_participantId: { roundId: round.id, participantId: participant.id } },
      create: { roundId: round.id, participantId: participant.id, text: normalizedText },
      update: { text: normalizedText },
    });

    revalidatePath(`/statie/${participant.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menyimpan transcript." };
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

    await startDebateWithRandomMissingVotes({
      roomId: leader.roomId,
      roundId: round.id,
      debateSeconds: leader.room.debateSeconds,
    });

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
      select: { id: true, statementId: true },
    });
    if (!round) return { success: false, message: "Tidak ada ronde aktif." };

    const voteCounts = await prisma.statieVote.groupBy({
      by: ["choice"],
      where: { roundId: round.id },
      _count: { choice: true },
    });

    const agreeCount = voteCounts.find((v) => v.choice === StatieVoteChoice.Agree)?._count.choice ?? 0;
    const disagreeCount = voteCounts.find((v) => v.choice === StatieVoteChoice.Disagree)?._count.choice ?? 0;

    await prisma.$transaction([
      prisma.statieRound.update({ where: { id: round.id }, data: { status: StatieRoundStatus.Finished, finishedAt: new Date() } }),
      prisma.statieRoom.update({ where: { id: leader.roomId }, data: { status: StatieRoomStatus.Lobby, currentRoundId: null } }),
      prisma.statieStatement.update({
        where: { id: round.statementId },
        data: { agreeCount: { increment: agreeCount }, disagreeCount: { increment: disagreeCount } },
      }),
    ]);

    try {
      await scoreStatieRound(round.id);
    } catch (scoreError) {
      await prisma.statieRound.update({
        where: { id: round.id },
        data: { aiScoreError: scoreError instanceof Error ? scoreError.message : "AI scoring gagal." },
      });
    }

    revalidatePath(`/statie/${leader.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menyelesaikan ronde." };
  }
}

export async function getStatieStatements(limit = 60) {
  const statements = await prisma.statieStatement.findMany({
    select: {
      id: true,
      topic: true,
      text: true,
      generatedByAi: true,
      usedCount: true,
      agreeCount: true,
      disagreeCount: true,
      createdAt: true,
    },
    orderBy: [{ usedCount: "desc" }, { createdAt: "desc" }],
    take: Math.min(120, Math.max(1, limit)),
  });

  return statements.map((statement) => ({
    id: statement.id,
    topic: statement.topic,
    text: statement.text,
    generatedByAi: statement.generatedByAi,
    usedCount: statement.usedCount,
    agreeCount: statement.agreeCount,
    disagreeCount: statement.disagreeCount,
    voteCount: statement.agreeCount + statement.disagreeCount,
    createdAt: statement.createdAt.toISOString(),
  }));
}

export async function cleanupOldStatieRooms() {
  const cutoff = new Date(Date.now() - ROOM_CLEANUP_MS);
  const result = await prisma.statieRoom.deleteMany({
    where: { updatedAt: { lt: cutoff } },
  });

  return { deleted: result.count, cutoff: cutoff.toISOString() };
}

export async function getStatieLeaderboard(limit = 10) {
  const rounds = await prisma.statieRound.findMany({
    where: { status: StatieRoundStatus.Finished, aiScore: { not: undefined } },
    select: {
      id: true,
      aiScore: true,
      aiScoredAt: true,
      statement: { select: { text: true } },
      votes: {
        select: {
          participantId: true,
          choice: true,
          participant: {
            select: {
              userId: true,
              guestName: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      },
      transcripts: {
        select: {
          participantId: true,
          participant: {
            select: {
              userId: true,
              guestName: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
    orderBy: { aiScoredAt: "desc" },
    take: 120,
  });

  type ScoreParticipant = {
    participantId: string;
    score: number;
    reason?: string;
  };

  type LeaderboardEntry = {
    key: string;
    name: string;
    rounds: number;
    totalScore: number;
    bestScore: number;
    latestScore: number;
    latestReason: string;
    latestStatement: string;
    agreeCount: number;
    disagreeCount: number;
    lastScoredAt: string | null;
  };

  const entries = new Map<string, LeaderboardEntry>();

  for (const round of rounds) {
    const score = round.aiScore;
    if (!score || typeof score !== "object" || !Array.isArray((score as { participants?: unknown }).participants)) continue;

    const participantsById = new Map<string, {
      userId: string | null;
      guestName: string | null;
      user: { name: string | null; email: string } | null;
    }>();
    for (const vote of round.votes) participantsById.set(vote.participantId, vote.participant);
    for (const transcript of round.transcripts) participantsById.set(transcript.participantId, transcript.participant);

    for (const item of (score as { participants: ScoreParticipant[] }).participants) {
      if (!item || typeof item.participantId !== "string" || typeof item.score !== "number") continue;
      const participant = participantsById.get(item.participantId);
      if (!participant) continue;

      const name = participantDisplayName(participant);
      const key = participant.userId ? `user:${participant.userId}` : `guest:${name.toLowerCase()}`;
      const vote = round.votes.find((v) => v.participantId === item.participantId)?.choice;
      const existing = entries.get(key);
      if (existing) {
        existing.rounds += 1;
        existing.totalScore += item.score;
        existing.bestScore = Math.max(existing.bestScore, item.score);
        if (vote === StatieVoteChoice.Agree) existing.agreeCount += 1;
        if (vote === StatieVoteChoice.Disagree) existing.disagreeCount += 1;
        if (!existing.lastScoredAt || (round.aiScoredAt && round.aiScoredAt.toISOString() > existing.lastScoredAt)) {
          existing.latestScore = item.score;
          existing.latestReason = item.reason ?? "";
          existing.latestStatement = round.statement.text;
          existing.lastScoredAt = round.aiScoredAt?.toISOString() ?? null;
        }
      } else {
        entries.set(key, {
          key,
          name,
          rounds: 1,
          totalScore: item.score,
          bestScore: item.score,
          latestScore: item.score,
          latestReason: item.reason ?? "",
          latestStatement: round.statement.text,
          agreeCount: vote === StatieVoteChoice.Agree ? 1 : 0,
          disagreeCount: vote === StatieVoteChoice.Disagree ? 1 : 0,
          lastScoredAt: round.aiScoredAt?.toISOString() ?? null,
        });
      }
    }
  }

  return Array.from(entries.values())
    .map((entry) => ({
      key: entry.key,
      name: entry.name,
      rounds: entry.rounds,
      averageScore: Math.round(entry.totalScore / entry.rounds),
      bestScore: Math.round(entry.bestScore),
      latestScore: Math.round(entry.latestScore),
      latestReason: entry.latestReason,
      latestStatement: entry.latestStatement,
      agreeCount: entry.agreeCount,
      disagreeCount: entry.disagreeCount,
      lastScoredAt: entry.lastScoredAt,
    }))
    .sort((a, b) => b.averageScore - a.averageScore || b.bestScore - a.bestScore || b.rounds - a.rounds)
    .slice(0, Math.min(50, Math.max(1, limit)));
}

export async function deleteStatieStatement(statementId: string): Promise<ActionResult<object>> {
  try {
    await requireAdmin();
    await prisma.statieStatement.delete({ where: { id: statementId } });
    revalidatePath("/statie");
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menghapus statement." };
  }
}

export async function getStatiePopularTopics(limit = 5) {
  const grouped = await prisma.statieStatement.groupBy({
    by: ["topic"],
    _count: { topic: true },
    orderBy: { _count: { topic: "desc" } },
    take: Math.min(20, Math.max(1, limit * 5)),
  });

  const seen = new Set<string>();
  const topics: { topic: string; count: number }[] = [];
  for (const group of grouped) {
    const normalized = normalizeTopic(group.topic);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    topics.push({ topic: normalized, count: group._count.topic });
    if (topics.length >= limit) break;
  }

  return topics;
}
