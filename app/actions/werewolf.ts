"use server";

import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { WerewolfRole, WerewolfRoomStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ROOM_CODE_LENGTH = 6;
const PARTICIPANT_COOKIE_DAYS = 14;
const MIN_PLAYERS = 4;
const MIN_PLAYER_LIMIT = 4;
const MAX_PLAYER_LIMIT = 16;

const MIN_NIGHT_SECONDS = 15;
const MAX_NIGHT_SECONDS = 300;
const MIN_DAY_SECONDS = 30;
const MAX_DAY_SECONDS = 600;
const MIN_VOTING_SECONDS = 15;
const MAX_VOTING_SECONDS = 300;
const MIN_REVOTE_SECONDS = 10;
const MAX_REVOTE_SECONDS = 120;

const DEFAULT_NIGHT_SECONDS = 60;
const DEFAULT_DAY_SECONDS = 120;
const DEFAULT_VOTING_SECONDS = 60;
const DEFAULT_REVOTE_SECONDS = 30;

type ActionResult<T = object> = ({ success: true } & T) | { success: false; message: string };

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 32);
}

function normalizeRoomCode(code: string) {
  return code.trim().replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function clampPlayerLimit(limit: number) {
  if (!Number.isFinite(limit)) return 10;
  return Math.min(MAX_PLAYER_LIMIT, Math.max(MIN_PLAYER_LIMIT, Math.round(limit)));
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampNightSeconds(value: number) {
  return clampInt(value, MIN_NIGHT_SECONDS, MAX_NIGHT_SECONDS, DEFAULT_NIGHT_SECONDS);
}

function clampDaySeconds(value: number) {
  return clampInt(value, MIN_DAY_SECONDS, MAX_DAY_SECONDS, DEFAULT_DAY_SECONDS);
}

function clampVotingSeconds(value: number) {
  return clampInt(value, MIN_VOTING_SECONDS, MAX_VOTING_SECONDS, DEFAULT_VOTING_SECONDS);
}

function clampRevoteSeconds(value: number) {
  return clampInt(value, MIN_REVOTE_SECONDS, MAX_REVOTE_SECONDS, DEFAULT_REVOTE_SECONDS);
}

function roomCookieName(code: string) {
  return `werewolf-room-${normalizeRoomCode(code).toLowerCase()}`;
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
    const existing = await prisma.werewolfRoom.findUnique({ where: { code }, select: { id: true } });
    if (!existing && code.length === ROOM_CODE_LENGTH) return code;
  }

  throw new Error("Gagal membuat kode room unik.");
}

async function requireParticipant(code: string) {
  const roomCode = normalizeRoomCode(code);
  const token = await getParticipantToken(roomCode);
  if (!token) return null;

  const participant = await prisma.werewolfParticipant.findFirst({
    where: { room: { code: roomCode }, token },
    include: { room: true, user: { select: { name: true, email: true } } },
  });
  if (!participant) return null;

  await prisma.werewolfParticipant.update({ where: { id: participant.id }, data: { lastSeenAt: new Date() } });
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

function shuffledRoles(playerCount: number) {
  const werewolfCount = playerCount >= 8 ? 2 : 1;
  const roles: WerewolfRole[] = [
    ...Array.from({ length: werewolfCount }, () => WerewolfRole.Werewolf),
    WerewolfRole.Seer,
    ...Array.from({ length: playerCount - werewolfCount - 1 }, () => WerewolfRole.Villager),
  ];

  for (let i = roles.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return roles;
}

function getWinReason(participants: { role: WerewolfRole | null; isAlive: boolean }[]) {
  const alive = participants.filter((participant) => participant.isAlive);
  const werewolves = alive.filter((participant) => participant.role === WerewolfRole.Werewolf).length;
  const villagers = alive.length - werewolves;

  if (werewolves === 0) return "Warga menang. Semua werewolf sudah tersingkir.";
  if (werewolves >= villagers) return "Werewolf menang. Jumlah mereka sudah menguasai desa.";
  return null;
}

async function resolveNight(roomId: string) {
  await prisma.$transaction(async (tx) => {
    const room = await tx.werewolfRoom.findUnique({
      where: { id: roomId },
      select: { id: true, status: true, phaseNumber: true, daySeconds: true },
    });
    if (!room || room.status !== WerewolfRoomStatus.Night) return;

    const [participants, nightActions] = await Promise.all([
      tx.werewolfParticipant.findMany({ where: { roomId }, select: { id: true, role: true, isAlive: true } }),
      tx.werewolfNightAction.findMany({ where: { roomId, phaseNumber: room.phaseNumber }, select: { actorId: true, targetId: true } }),
    ]);

    const isOpeningNight = room.phaseNumber === 1;
    const aliveWerewolfIds = new Set(
      participants.filter((p) => p.isAlive && p.role === WerewolfRole.Werewolf).map((p) => p.id),
    );
    const killSubmissions = isOpeningNight ? [] : nightActions.filter((action) => aliveWerewolfIds.has(action.actorId));

    const tally = new Map<string, number>();
    for (const action of killSubmissions) tally.set(action.targetId, (tally.get(action.targetId) ?? 0) + 1);

    let killTargetId: string | null = null;
    if (tally.size > 0) {
      const topCount = Math.max(...tally.values());
      const topTargets = [...tally.entries()].filter(([, count]) => count === topCount).map(([id]) => id);
      killTargetId = topTargets[crypto.randomInt(topTargets.length)];
    }

    if (killTargetId) {
      await tx.werewolfParticipant.update({ where: { id: killTargetId }, data: { isAlive: false, eliminatedAt: new Date() } });
    }

    const nextParticipants = participants.map((p) => (p.id === killTargetId ? { ...p, isAlive: false } : p));
    const finishedReason = getWinReason(nextParticipants);
    const now = new Date();

    if (finishedReason) {
      await tx.werewolfRoom.update({
        where: { id: roomId },
        data: { status: WerewolfRoomStatus.Finished, finishedReason, phaseEndsAt: null, lastEliminatedId: killTargetId },
      });
    } else {
      await tx.werewolfRoom.update({
        where: { id: roomId },
        data: {
          status: WerewolfRoomStatus.Day,
          phaseEndsAt: new Date(now.getTime() + room.daySeconds * 1000),
          lastEliminatedId: killTargetId,
        },
      });
    }
  });
}

async function startVoting(roomId: string) {
  await prisma.$transaction(async (tx) => {
    const room = await tx.werewolfRoom.findUnique({
      where: { id: roomId },
      select: { id: true, status: true, votingSeconds: true },
    });
    if (!room || room.status !== WerewolfRoomStatus.Day) return;

    const now = new Date();
    await tx.werewolfVote.deleteMany({ where: { roomId } });
    await tx.werewolfRoom.update({
      where: { id: roomId },
      data: {
        status: WerewolfRoomStatus.Voting,
        currentVoteRound: 1,
        revoteCandidates: null,
        phaseEndsAt: new Date(now.getTime() + room.votingSeconds * 1000),
      },
    });
  });
}

async function resolveVoting(roomId: string) {
  await prisma.$transaction(async (tx) => {
    const room = await tx.werewolfRoom.findUnique({
      where: { id: roomId },
      select: { id: true, status: true, currentVoteRound: true, phaseNumber: true, nightSeconds: true, revoteSeconds: true },
    });
    if (!room || (room.status !== WerewolfRoomStatus.Voting && room.status !== WerewolfRoomStatus.Revote)) return;

    const [participants, votes] = await Promise.all([
      tx.werewolfParticipant.findMany({ where: { roomId }, select: { id: true, role: true, isAlive: true } }),
      tx.werewolfVote.findMany({ where: { roomId, round: room.currentVoteRound }, select: { voterId: true, targetId: true } }),
    ]);

    const aliveIds = new Set(participants.filter((p) => p.isAlive).map((p) => p.id));
    const tally = new Map<string, number>();
    for (const vote of votes) {
      if (!aliveIds.has(vote.targetId)) continue;
      tally.set(vote.targetId, (tally.get(vote.targetId) ?? 0) + 1);
    }

    let topCount = 0;
    for (const count of tally.values()) if (count > topCount) topCount = count;
    const topTargets = [...tally.entries()].filter(([, count]) => count === topCount).map(([id]) => id);
    const now = new Date();

    if (topTargets.length > 1) {
      if (room.currentVoteRound === 1) {
        await tx.werewolfRoom.update({
          where: { id: roomId },
          data: {
            status: WerewolfRoomStatus.Revote,
            currentVoteRound: 2,
            revoteCandidates: topTargets.join(","),
            phaseEndsAt: new Date(now.getTime() + room.revoteSeconds * 1000),
          },
        });
        return;
      }

      const finishedReason = getWinReason(participants);
      if (finishedReason) {
        await tx.werewolfRoom.update({
          where: { id: roomId },
          data: { status: WerewolfRoomStatus.Finished, finishedReason, revoteCandidates: null, lastEliminatedId: null, phaseEndsAt: null },
        });
      } else {
        await tx.werewolfRoom.update({
          where: { id: roomId },
          data: {
            status: WerewolfRoomStatus.Night,
            phaseNumber: room.phaseNumber + 1,
            revoteCandidates: null,
            lastEliminatedId: null,
            phaseEndsAt: new Date(now.getTime() + room.nightSeconds * 1000),
          },
        });
      }
      return;
    }

    const eliminatedId = topTargets[0] ?? null;
    if (eliminatedId) {
      await tx.werewolfParticipant.update({ where: { id: eliminatedId }, data: { isAlive: false, eliminatedAt: new Date() } });
    }
    const nextParticipants = participants.map((p) => (p.id === eliminatedId ? { ...p, isAlive: false } : p));
    const finishedReason = getWinReason(nextParticipants);

    if (finishedReason) {
      await tx.werewolfRoom.update({
        where: { id: roomId },
        data: { status: WerewolfRoomStatus.Finished, finishedReason, lastEliminatedId: eliminatedId, revoteCandidates: null, phaseEndsAt: null },
      });
    } else {
      await tx.werewolfRoom.update({
        where: { id: roomId },
        data: {
          status: WerewolfRoomStatus.Night,
          phaseNumber: room.phaseNumber + 1,
          lastEliminatedId: eliminatedId,
          revoteCandidates: null,
          phaseEndsAt: new Date(now.getTime() + room.nightSeconds * 1000),
        },
      });
    }
  });
}

async function resolveExpiredPhase(roomId: string) {
  const room = await prisma.werewolfRoom.findUnique({
    where: { id: roomId },
    select: { id: true, status: true, phaseEndsAt: true },
  });
  if (!room || !room.phaseEndsAt) return;
  if (Date.now() < room.phaseEndsAt.getTime()) return;

  if (room.status === WerewolfRoomStatus.Night) await resolveNight(roomId);
  else if (room.status === WerewolfRoomStatus.Day) await startVoting(roomId);
  else if (room.status === WerewolfRoomStatus.Voting) await resolveVoting(roomId);
  else if (room.status === WerewolfRoomStatus.Revote) await resolveVoting(roomId);
}

async function maybeAutoResolveNight(roomId: string, phaseNumber: number) {
  const [participants, nightActions, seerChecks] = await Promise.all([
    prisma.werewolfParticipant.findMany({ where: { roomId }, select: { id: true, role: true, isAlive: true } }),
    prisma.werewolfNightAction.findMany({ where: { roomId, phaseNumber }, select: { actorId: true } }),
    prisma.werewolfSeerCheck.findMany({ where: { roomId, phaseNumber }, select: { actorId: true } }),
  ]);
  const aliveWerewolfIds = participants.filter((p) => p.isAlive && p.role === WerewolfRole.Werewolf).map((p) => p.id);
  const aliveSeer = participants.find((p) => p.isAlive && p.role === WerewolfRole.Seer);
    const allWerewolvesSubmitted = phaseNumber === 1 || aliveWerewolfIds.every((id) => nightActions.some((a) => a.actorId === id));
  const seerSubmitted = aliveSeer ? seerChecks.some((c) => c.actorId === aliveSeer.id) : true;
  if (allWerewolvesSubmitted && seerSubmitted) await resolveNight(roomId);
}

export async function createWerewolfRoom(input: {
  leaderName?: string;
  playerLimit?: number;
  nightSeconds?: number;
  daySeconds?: number;
  votingSeconds?: number;
  revoteSeconds?: number;
}): Promise<ActionResult<{ code: string }>> {
  try {
    const session = await getOptionalSession();
    const leaderName = normalizeName(input.leaderName ?? "");
    if (!session && !leaderName) return { success: false, message: "Nama leader wajib diisi untuk guest." };

    const code = await generateUniqueRoomCode();
    const token = crypto.randomBytes(24).toString("base64url");

    await prisma.werewolfRoom.create({
      data: {
        code,
        leaderUserId: session?.user.id,
        leaderGuestName: session ? null : leaderName,
        leaderToken: token,
        playerLimit: clampPlayerLimit(input.playerLimit ?? 10),
        nightSeconds: clampNightSeconds(input.nightSeconds ?? DEFAULT_NIGHT_SECONDS),
        daySeconds: clampDaySeconds(input.daySeconds ?? DEFAULT_DAY_SECONDS),
        votingSeconds: clampVotingSeconds(input.votingSeconds ?? DEFAULT_VOTING_SECONDS),
        revoteSeconds: clampRevoteSeconds(input.revoteSeconds ?? DEFAULT_REVOTE_SECONDS),
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

export async function updateWerewolfTimers(
  code: string,
  input: { nightSeconds?: number; daySeconds?: number; votingSeconds?: number; revoteSeconds?: number },
): Promise<ActionResult> {
  try {
    const leader = await requireLeader(code);
    if (leader.room.status !== WerewolfRoomStatus.Lobby) return { success: false, message: "Timer hanya bisa diatur di lobby." };

    const data: { nightSeconds?: number; daySeconds?: number; votingSeconds?: number; revoteSeconds?: number } = {};
    if (input.nightSeconds !== undefined) data.nightSeconds = clampNightSeconds(input.nightSeconds);
    if (input.daySeconds !== undefined) data.daySeconds = clampDaySeconds(input.daySeconds);
    if (input.votingSeconds !== undefined) data.votingSeconds = clampVotingSeconds(input.votingSeconds);
    if (input.revoteSeconds !== undefined) data.revoteSeconds = clampRevoteSeconds(input.revoteSeconds);

    await prisma.werewolfRoom.update({ where: { id: leader.roomId }, data });
    revalidatePath(`/werewolf-multiplayer/${leader.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal mengatur timer." };
  }
}

export async function joinWerewolfRoom(code: string, name?: string): Promise<ActionResult<{ code: string }>> {
  try {
    const roomCode = normalizeRoomCode(code);
    if (!roomCode) return { success: false, message: "Kode room tidak valid." };

    const room = await prisma.werewolfRoom.findUnique({
      where: { code: roomCode },
      select: { id: true, status: true, playerLimit: true, _count: { select: { participants: true } } },
    });
    if (!room) return { success: false, message: "Room tidak ditemukan." };

    const existingToken = await getParticipantToken(roomCode);
    const existing = existingToken
      ? await prisma.werewolfParticipant.findFirst({ where: { roomId: room.id, token: existingToken } })
      : null;
    if (existing) {
      await prisma.werewolfParticipant.update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } });
      return { success: true, code: roomCode };
    }

    if (room.status !== WerewolfRoomStatus.Lobby) return { success: false, message: "Game sudah berjalan." };
    if (room._count.participants >= room.playerLimit) return { success: false, message: "Room sudah penuh." };

    const session = await getOptionalSession();
    const guestName = normalizeName(name ?? "");
    if (!session && !guestName) return { success: false, message: "Nama wajib diisi untuk guest." };

    const token = crypto.randomBytes(24).toString("base64url");
    await prisma.werewolfParticipant.create({
      data: { roomId: room.id, userId: session?.user.id, guestName: session ? null : guestName, token },
    });

    await setParticipantCookie(roomCode, token);
    revalidatePath(`/werewolf-multiplayer/${roomCode}`);
    return { success: true, code: roomCode };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal bergabung ke room." };
  }
}

export async function getWerewolfRoomState(code: string) {
  const roomCode = normalizeRoomCode(code);
  const participant = await requireParticipant(roomCode);

  const fetchRoom = () =>
    prisma.werewolfRoom.findUnique({
      where: { code: roomCode },
      include: {
        participants: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: [{ isLeader: "desc" }, { joinedAt: "asc" }],
        },
        votes: true,
        nightActions: true,
        seerChecks: true,
      },
    });

  let room = await fetchRoom();
  if (!room) return null;

  await resolveExpiredPhase(room.id);
  room = await fetchRoom();
  if (!room) return null;

  const showRoles = room.status === WerewolfRoomStatus.Finished;
  const isVotingPhase = room.status === WerewolfRoomStatus.Voting || room.status === WerewolfRoomStatus.Revote;

  const roundVotes = room.votes.filter((v) => v.round === room.currentVoteRound);
  const voteCounts = new Map<string, number>();
  for (const vote of roundVotes) voteCounts.set(vote.targetId, (voteCounts.get(vote.targetId) ?? 0) + 1);

  const aliveParticipants = room.participants.filter((p) => p.isAlive);
  const aliveIds = new Set(aliveParticipants.map((p) => p.id));

  const phaseNightActions = room.nightActions.filter((a) => a.phaseNumber === room.phaseNumber);
  const phaseSeerChecks = room.seerChecks.filter((c) => c.phaseNumber === room.phaseNumber);

  const aliveWerewolves = aliveParticipants.filter((p) => p.role === WerewolfRole.Werewolf);
  const aliveSeer = aliveParticipants.find((p) => p.role === WerewolfRole.Seer);
  const allWerewolvesSubmitted = room.phaseNumber === 1 || aliveWerewolves.every((w) => phaseNightActions.some((a) => a.actorId === w.id));
  const seerSubmitted = aliveSeer ? phaseSeerChecks.some((c) => c.actorId === aliveSeer.id) : true;
  const nightActionSubmitted = room.status === WerewolfRoomStatus.Night ? allWerewolvesSubmitted && seerSubmitted : false;

  const revoteCandidateIds = room.revoteCandidates ? room.revoteCandidates.split(",").filter(Boolean) : null;
  const lastEliminated = room.lastEliminatedId ? room.participants.find((p) => p.id === room.lastEliminatedId) : null;

  const myRole = participant?.role ?? null;
  const fellowWerewolves =
    myRole === WerewolfRole.Werewolf && room.status !== WerewolfRoomStatus.Lobby
      ? aliveWerewolves
          .filter((w) => w.id !== participant?.id)
          .map((w) => ({ id: w.id, name: participantDisplayName(w) }))
      : null;

  const mySeerChecks =
    myRole === WerewolfRole.Seer
      ? room.seerChecks
          .filter((c) => c.actorId === participant?.id)
          .sort((a, b) => a.phaseNumber - b.phaseNumber)
          .map((c) => ({
            phaseNumber: c.phaseNumber,
            targetName: participantDisplayName(room.participants.find((p) => p.id === c.targetId) ?? { guestName: null, user: null }),
            inspectedRole: c.inspectedRole,
          }))
      : null;

  const myKillTargetId =
    myRole === WerewolfRole.Werewolf && room.status === WerewolfRoomStatus.Night
      ? phaseNightActions.find((a) => a.actorId === participant?.id)?.targetId ?? null
      : null;
  const mySeerCheckTargetId =
    myRole === WerewolfRole.Seer && room.status === WerewolfRoomStatus.Night
      ? phaseSeerChecks.find((c) => c.actorId === participant?.id)?.targetId ?? null
      : null;
  const myVoteTargetId = isVotingPhase ? roundVotes.find((v) => v.voterId === participant?.id)?.targetId ?? null : null;

  const votedCount = roundVotes.filter((v) => aliveIds.has(v.voterId)).length;

  return {
    code: room.code,
    status: room.status,
    phaseNumber: room.phaseNumber,
    playerLimit: room.playerLimit,
    minPlayers: MIN_PLAYERS,
    finishedReason: room.finishedReason,
    phaseEndsAt: room.phaseEndsAt?.toISOString() ?? null,
    nightSeconds: room.nightSeconds,
    daySeconds: room.daySeconds,
    votingSeconds: room.votingSeconds,
    revoteSeconds: room.revoteSeconds,
    currentVoteRound: room.currentVoteRound,
    isJoined: Boolean(participant),
    isLeader: Boolean(participant?.isLeader && participant.token === room.leaderToken),
    me: participant ? { id: participant.id, name: participantDisplayName(participant), isAlive: participant.isAlive } : null,
    myRole,
    fellowWerewolves,
    mySeerChecks,
    myKillTargetId,
    mySeerCheckTargetId,
    myVoteTargetId,
    lastEliminatedName: lastEliminated ? participantDisplayName(lastEliminated) : null,
    aliveCount: aliveParticipants.length,
    werewolfCount: showRoles ? room.participants.filter((p) => p.role === WerewolfRole.Werewolf).length : null,
    nightActionSubmitted,
    revoteCandidateIds,
    votedCount,
    totalAliveVoters: aliveParticipants.length,
    participants: room.participants.map((item) => ({
      id: item.id,
      name: participantDisplayName(item),
      isLeader: item.isLeader,
      isAlive: item.isAlive,
      role: showRoles ? item.role : null,
      voteCount: isVotingPhase ? voteCounts.get(item.id) ?? 0 : 0,
      hasVoted: isVotingPhase ? roundVotes.some((v) => v.voterId === item.id) : false,
      lastSeenAt: item.lastSeenAt.toISOString(),
    })),
  };
}

export async function updateWerewolfPlayerLimit(code: string, limitInput: number): Promise<ActionResult> {
  try {
    const leader = await requireLeader(code);
    if (leader.room.status !== WerewolfRoomStatus.Lobby) return { success: false, message: "Limit hanya bisa diganti di lobby." };
    const playerLimit = clampPlayerLimit(limitInput);
    const currentCount = await prisma.werewolfParticipant.count({ where: { roomId: leader.roomId } });
    if (playerLimit < currentCount) return { success: false, message: `Limit minimal ${currentCount} karena sudah ada ${currentCount} pemain.` };

    await prisma.werewolfRoom.update({ where: { id: leader.roomId }, data: { playerLimit } });
    revalidatePath(`/werewolf-multiplayer/${leader.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal mengganti limit pemain." };
  }
}

export async function startWerewolfGame(code: string): Promise<ActionResult> {
  try {
    const leader = await requireLeader(code);
    if (leader.room.status !== WerewolfRoomStatus.Lobby) return { success: false, message: "Game sudah dimulai." };

    const participants = await prisma.werewolfParticipant.findMany({
      where: { roomId: leader.roomId },
      orderBy: { joinedAt: "asc" },
      select: { id: true },
    });
    if (participants.length < MIN_PLAYERS) return { success: false, message: `Butuh minimal ${MIN_PLAYERS} pemain.` };

    const roles = shuffledRoles(participants.length);
    const now = new Date();
    const phaseEndsAt = new Date(now.getTime() + leader.room.nightSeconds * 1000);

    await prisma.$transaction([
      ...participants.map((participant, index) =>
        prisma.werewolfParticipant.update({
          where: { id: participant.id },
          data: { role: roles[index], isAlive: true, eliminatedAt: null },
        }),
      ),
      prisma.werewolfVote.deleteMany({ where: { roomId: leader.roomId } }),
      prisma.werewolfNightAction.deleteMany({ where: { roomId: leader.roomId } }),
      prisma.werewolfSeerCheck.deleteMany({ where: { roomId: leader.roomId } }),
      prisma.werewolfRoom.update({
        where: { id: leader.roomId },
        data: {
          status: WerewolfRoomStatus.Night,
          phaseNumber: 1,
          currentVoteRound: 1,
          revoteCandidates: null,
          lastEliminatedId: null,
          finishedReason: null,
          phaseEndsAt,
        },
      }),
    ]);

    revalidatePath(`/werewolf-multiplayer/${leader.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal memulai game." };
  }
}

export async function submitWerewolfKillTarget(code: string, targetId: string): Promise<ActionResult> {
  try {
    const participant = await requireParticipant(code);
    if (!participant) return { success: false, message: "Bergabung ke room terlebih dahulu." };
    await resolveExpiredPhase(participant.roomId);

    const room = await prisma.werewolfRoom.findUnique({
      where: { id: participant.roomId },
      select: { id: true, status: true, phaseNumber: true, code: true },
    });
    if (!room) return { success: false, message: "Room tidak ditemukan." };
    if (room.status !== WerewolfRoomStatus.Night) return { success: false, message: "Bukan fase malam." };
    if (room.phaseNumber === 1) return { success: false, message: "Malam 1 hanya perkenalan. Kill dimulai pada Malam 2." };
    if (!participant.isAlive) return { success: false, message: "Pemain gugur tidak bisa aksi malam." };
    if (participant.role !== WerewolfRole.Werewolf) return { success: false, message: "Hanya werewolf yang bisa memilih target kill." };

    const target = await prisma.werewolfParticipant.findFirst({
      where: { id: targetId, roomId: participant.roomId, isAlive: true },
      select: { id: true, role: true },
    });
    if (!target) return { success: false, message: "Target tidak valid." };
    if (target.role === WerewolfRole.Werewolf) return { success: false, message: "Werewolf tidak bisa membunuh sesama werewolf." };

    await prisma.werewolfNightAction.upsert({
      where: { roomId_phaseNumber_actorId: { roomId: participant.roomId, phaseNumber: room.phaseNumber, actorId: participant.id } },
      create: { roomId: participant.roomId, phaseNumber: room.phaseNumber, actorId: participant.id, targetId: target.id },
      update: { targetId: target.id },
    });

    await maybeAutoResolveNight(participant.roomId, room.phaseNumber);
    revalidatePath(`/werewolf-multiplayer/${room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menyimpan aksi kill." };
  }
}

export async function submitSeerCheck(code: string, targetId: string): Promise<ActionResult> {
  try {
    const participant = await requireParticipant(code);
    if (!participant) return { success: false, message: "Bergabung ke room terlebih dahulu." };
    await resolveExpiredPhase(participant.roomId);

    const room = await prisma.werewolfRoom.findUnique({
      where: { id: participant.roomId },
      select: { id: true, status: true, phaseNumber: true, code: true },
    });
    if (!room) return { success: false, message: "Room tidak ditemukan." };
    if (room.status !== WerewolfRoomStatus.Night) return { success: false, message: "Bukan fase malam." };
    if (!participant.isAlive) return { success: false, message: "Pemain gugur tidak bisa aksi malam." };
    if (participant.role !== WerewolfRole.Seer) return { success: false, message: "Hanya seer yang bisa memeriksa." };

    const target = await prisma.werewolfParticipant.findFirst({
      where: { id: targetId, roomId: participant.roomId, isAlive: true },
      select: { id: true, role: true },
    });
    if (!target) return { success: false, message: "Target tidak valid." };
    if (target.id === participant.id) return { success: false, message: "Tidak bisa memeriksa diri sendiri." };
    if (!target.role) return { success: false, message: "Target tidak valid." };

    const existingCheck = await prisma.werewolfSeerCheck.findUnique({
      where: { roomId_phaseNumber_actorId: { roomId: participant.roomId, phaseNumber: room.phaseNumber, actorId: participant.id } },
      select: { id: true },
    });
    if (existingCheck) return { success: false, message: "Seer hanya bisa memeriksa satu pemain per malam." };

    await prisma.werewolfSeerCheck.create({
      data: { roomId: participant.roomId, phaseNumber: room.phaseNumber, actorId: participant.id, targetId: target.id, inspectedRole: target.role },
    });

    await maybeAutoResolveNight(participant.roomId, room.phaseNumber);
    revalidatePath(`/werewolf-multiplayer/${room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menyimpan pemeriksaan." };
  }
}

export async function advanceWerewolfPhase(code: string): Promise<ActionResult> {
  try {
    const leader = await requireLeader(code);
    const room = await prisma.werewolfRoom.findUnique({ where: { id: leader.roomId }, select: { id: true, status: true, code: true } });
    if (!room) return { success: false, message: "Room tidak ditemukan." };

    if (room.status === WerewolfRoomStatus.Night) await resolveNight(leader.roomId);
    else if (room.status === WerewolfRoomStatus.Day) await startVoting(leader.roomId);
    else return { success: false, message: "Fase ini tidak bisa di-advance manual." };

    revalidatePath(`/werewolf-multiplayer/${room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal lanjut fase." };
  }
}

export async function submitWerewolfVote(code: string, targetId: string): Promise<ActionResult> {
  try {
    const participant = await requireParticipant(code);
    if (!participant) return { success: false, message: "Bergabung ke room terlebih dahulu." };
    await resolveExpiredPhase(participant.roomId);

    const room = await prisma.werewolfRoom.findUnique({
      where: { id: participant.roomId },
      select: { id: true, status: true, currentVoteRound: true, revoteCandidates: true, code: true },
    });
    if (!room) return { success: false, message: "Room tidak ditemukan." };
    if (room.status !== WerewolfRoomStatus.Voting && room.status !== WerewolfRoomStatus.Revote) return { success: false, message: "Bukan fase voting." };
    if (!participant.isAlive) return { success: false, message: "Pemain gugur tidak bisa vote." };

    const target = await prisma.werewolfParticipant.findFirst({
      where: { id: targetId, roomId: participant.roomId, isAlive: true },
      select: { id: true },
    });
    if (!target) return { success: false, message: "Target vote tidak valid." };

    if (room.status === WerewolfRoomStatus.Revote) {
      const allowed = room.revoteCandidates ? room.revoteCandidates.split(",").filter(Boolean) : [];
      if (!allowed.includes(target.id)) return { success: false, message: "Hanya pilih kandidat yang seri." };
    }

    await prisma.werewolfVote.upsert({
      where: { roomId_round_voterId: { roomId: participant.roomId, round: room.currentVoteRound, voterId: participant.id } },
      create: { roomId: participant.roomId, round: room.currentVoteRound, voterId: participant.id, targetId: target.id },
      update: { targetId: target.id },
    });

    const [aliveCount, voteCount] = await Promise.all([
      prisma.werewolfParticipant.count({ where: { roomId: participant.roomId, isAlive: true } }),
      prisma.werewolfVote.count({ where: { roomId: participant.roomId, round: room.currentVoteRound } }),
    ]);
    if (voteCount >= aliveCount) await resolveVoting(participant.roomId);

    revalidatePath(`/werewolf-multiplayer/${room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal menyimpan vote." };
  }
}

export async function resolveWerewolfVoting(code: string): Promise<ActionResult> {
  try {
    const leader = await requireLeader(code);
    const room = await prisma.werewolfRoom.findUnique({ where: { id: leader.roomId }, select: { id: true, status: true, code: true } });
    if (!room) return { success: false, message: "Room tidak ditemukan." };
    if (room.status !== WerewolfRoomStatus.Voting && room.status !== WerewolfRoomStatus.Revote) return { success: false, message: "Bukan fase voting." };

    await resolveVoting(leader.roomId);
    revalidatePath(`/werewolf-multiplayer/${room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal resolve voting." };
  }
}
