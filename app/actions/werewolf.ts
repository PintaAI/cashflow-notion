"use server";

import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { WerewolfRoomStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEFAULT_WEREWOLF_CONTROL_MODE, type WerewolfRoleName } from "@/lib/werewolf/game-state";

const ROOM_CODE_LENGTH = 6;
const PARTICIPANT_COOKIE_DAYS = 14;
const MIN_PLAYERS = 4;
const MIN_PLAYER_LIMIT = 4;
const MAX_PLAYER_LIMIT = 16;

const DEFAULT_NIGHT_SECONDS = 60;
const DEFAULT_DAY_SECONDS = 120;
const DEFAULT_VOTING_SECONDS = 60;
const DEFAULT_REVOTE_SECONDS = 30;
const WEREWOLF_ROLES = ["Werewolf", "Seer", "Doctor", "Jester", "Villager"] as const satisfies readonly WerewolfRoleName[];
const DEFAULT_AVAILABLE_ROLES: WerewolfRoleName[] = ["Werewolf", "Villager"];

type ActionResult<T = object> = ({ success: true } & T) | { success: false; message: string };

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 32);
}

function normalizeRoomCode(code: string) {
  return code.trim().replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampPlayerLimit(limit: number) {
  return clampInt(limit, MIN_PLAYER_LIMIT, MAX_PLAYER_LIMIT, 10);
}

function normalizeAvailableRoles(roles: string[] | undefined): WerewolfRoleName[] {
  const selected = new Set((roles?.length ? roles : DEFAULT_AVAILABLE_ROLES).filter((role): role is WerewolfRoleName => WEREWOLF_ROLES.includes(role as WerewolfRoleName)));
  selected.add("Werewolf");
  selected.add("Villager");
  return WEREWOLF_ROLES.filter((role) => selected.has(role));
}

function clampMaxWerewolves(value: number | undefined) {
  return clampInt(value ?? 2, 1, 4, 2);
}

function roomCookieName(code: string) {
  return `werewolf-room-${normalizeRoomCode(code).toLowerCase()}`;
}

async function getOptionalSession() {
  return auth.api.getSession({ headers: await headers() });
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

function participantDisplayName(participant: {
  guestName: string | null;
  user: { name: string | null; email: string } | null;
}) {
  return participant.user?.name || participant.user?.email.split("@")[0] || participant.guestName || "Guest";
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
    throw new Error("Hanya moderator yang bisa mengontrol room.");
  }
  return participant;
}

export async function createWerewolfRoom(input: {
  leaderName?: string;
  hasModerator?: boolean;
  playerLimit?: number;
  availableRoles?: string[];
  maxWerewolves?: number;
  nightSeconds?: number;
  daySeconds?: number;
  votingSeconds?: number;
  revoteSeconds?: number;
}): Promise<ActionResult<{ code: string }>> {
  try {
    const session = await getOptionalSession();
    const leaderName = normalizeName(input.leaderName ?? "");
    const hasModerator = input.hasModerator ?? true;
    if (!session && !leaderName) return { success: false, message: "Nama display wajib diisi untuk guest." };

    const code = await generateUniqueRoomCode();
    const token = crypto.randomBytes(24).toString("base64url");

    await prisma.werewolfRoom.create({
      data: {
        code,
        leaderUserId: session?.user.id,
        leaderGuestName: session ? null : leaderName,
        leaderToken: token,
        playerLimit: clampPlayerLimit(input.playerLimit ?? 10),
        availableRoles: normalizeAvailableRoles(input.availableRoles),
        maxWerewolves: clampMaxWerewolves(input.maxWerewolves),
        nightSeconds: clampInt(input.nightSeconds ?? DEFAULT_NIGHT_SECONDS, 15, 300, DEFAULT_NIGHT_SECONDS),
        daySeconds: clampInt(input.daySeconds ?? DEFAULT_DAY_SECONDS, 30, 600, DEFAULT_DAY_SECONDS),
        votingSeconds: clampInt(input.votingSeconds ?? DEFAULT_VOTING_SECONDS, 15, 300, DEFAULT_VOTING_SECONDS),
        revoteSeconds: clampInt(input.revoteSeconds ?? DEFAULT_REVOTE_SECONDS, 10, 120, DEFAULT_REVOTE_SECONDS),
        participants: {
          create: {
            userId: session?.user.id,
            guestName: session ? null : leaderName,
            token,
            isLeader: true,
            isModerator: hasModerator,
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

export async function joinWerewolfRoom(code: string, name?: string): Promise<ActionResult<{ code: string }>> {
  try {
    const roomCode = normalizeRoomCode(code);
    if (!roomCode) return { success: false, message: "Kode room tidak valid." };

    const room = await prisma.werewolfRoom.findUnique({
      where: { code: roomCode },
      select: { id: true, status: true, playerLimit: true },
    });
    if (!room) return { success: false, message: "Room tidak ditemukan." };

    const existingToken = await getParticipantToken(roomCode);
    const existing = existingToken ? await prisma.werewolfParticipant.findFirst({ where: { roomId: room.id, token: existingToken } }) : null;
    if (existing) {
      await prisma.werewolfParticipant.update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } });
      return { success: true, code: roomCode };
    }

    if (room.status !== WerewolfRoomStatus.Lobby) return { success: false, message: "Game sudah berjalan." };
    const playerCount = await prisma.werewolfParticipant.count({ where: { roomId: room.id, isModerator: false } });
    if (playerCount >= room.playerLimit) return { success: false, message: "Room sudah penuh." };

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
  const room = await prisma.werewolfRoom.findUnique({
    where: { code: roomCode },
    include: {
      participants: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: [{ isLeader: "desc" }, { joinedAt: "asc" }],
      },
    },
  });
  if (!room) return null;

    const hasModerator = room.participants.some((item) => item.isModerator);
    const participants = room.participants.map((item) => ({
      id: item.id,
      name: participantDisplayName(item),
      isLeader: item.isLeader,
      isModerator: item.isModerator,
      isAlive: true,
    role: null,
    voteCount: 0,
    hasVoted: false,
    lastSeenAt: item.lastSeenAt.toISOString(),
  }));

    return {
      code: room.code,
      status: room.status,
      controlMode: hasModerator ? "Moderator" as const : DEFAULT_WEREWOLF_CONTROL_MODE,
      phaseNumber: 0,
    playerLimit: room.playerLimit,
    availableRoles: normalizeAvailableRoles(room.availableRoles),
    maxWerewolves: clampMaxWerewolves(room.maxWerewolves),
    minPlayers: MIN_PLAYERS,
    finishedReason: null,
    phaseEndsAt: null,
    nightSeconds: room.nightSeconds,
    daySeconds: room.daySeconds,
    votingSeconds: room.votingSeconds,
    revoteSeconds: room.revoteSeconds,
    currentVoteRound: 1,
    isJoined: Boolean(participant),
    isLeader: Boolean(participant?.isLeader && participant.token === room.leaderToken),
      me: participant ? { id: participant.id, name: participantDisplayName(participant), isAlive: true, isModerator: participant.isModerator } : null,
    myRole: null,
    fellowWerewolves: null,
    mySeerChecks: null,
    myKillTargetId: null,
    mySeerCheckTargetId: null,
    myVoteTargetId: null,
    lastEliminatedName: null,
    lastEliminatedRole: null,
    lastEliminatedSource: null,
    aliveCount: participants.filter((item) => !item.isModerator).length,
    werewolfCount: null,
    nightActionSubmitted: false,
    revoteCandidateIds: null,
    votedCount: 0,
      totalAliveVoters: participants.filter((item) => !item.isModerator).length,
    participants,
  };
}

export async function updateWerewolfTimers(
  code: string,
  input: { nightSeconds?: number; daySeconds?: number; votingSeconds?: number; revoteSeconds?: number },
): Promise<ActionResult> {
  try {
    const leader = await requireLeader(code);
    if (leader.room.status !== WerewolfRoomStatus.Lobby) return { success: false, message: "Timer hanya bisa diatur di lobby." };
    await prisma.werewolfRoom.update({
      where: { id: leader.roomId },
      data: {
        ...(input.nightSeconds !== undefined ? { nightSeconds: clampInt(input.nightSeconds, 15, 300, DEFAULT_NIGHT_SECONDS) } : null),
        ...(input.daySeconds !== undefined ? { daySeconds: clampInt(input.daySeconds, 30, 600, DEFAULT_DAY_SECONDS) } : null),
        ...(input.votingSeconds !== undefined ? { votingSeconds: clampInt(input.votingSeconds, 15, 300, DEFAULT_VOTING_SECONDS) } : null),
        ...(input.revoteSeconds !== undefined ? { revoteSeconds: clampInt(input.revoteSeconds, 10, 120, DEFAULT_REVOTE_SECONDS) } : null),
      },
    });
    revalidatePath(`/werewolf-multiplayer/${leader.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal mengatur timer." };
  }
}

export async function updateWerewolfPlayerLimit(code: string, limitInput: number): Promise<ActionResult> {
  try {
    const leader = await requireLeader(code);
    if (leader.room.status !== WerewolfRoomStatus.Lobby) return { success: false, message: "Limit hanya bisa diganti di lobby." };
    const playerLimit = clampPlayerLimit(limitInput);
    const currentCount = await prisma.werewolfParticipant.count({ where: { roomId: leader.roomId, isModerator: false } });
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
    const participantCount = await prisma.werewolfParticipant.count({ where: { roomId: leader.roomId, isModerator: false } });
    if (participantCount < MIN_PLAYERS) return { success: false, message: `Butuh minimal ${MIN_PLAYERS} pemain.` };
    await prisma.werewolfRoom.update({ where: { id: leader.roomId }, data: { status: WerewolfRoomStatus.Active } });
    revalidatePath(`/werewolf-multiplayer/${leader.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal memulai game." };
  }
}

export async function restartWerewolfGame(code: string): Promise<ActionResult> {
  try {
    const leader = await requireLeader(code);
    const participantCount = await prisma.werewolfParticipant.count({ where: { roomId: leader.roomId, isModerator: false } });
    if (participantCount < MIN_PLAYERS) return { success: false, message: `Butuh minimal ${MIN_PLAYERS} pemain.` };
    await prisma.werewolfRoom.update({ where: { id: leader.roomId }, data: { status: WerewolfRoomStatus.Active } });
    revalidatePath(`/werewolf-multiplayer/${leader.room.code}`);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal restart game." };
  }
}

export async function submitWerewolfKillTarget(code: string, _targetId: string): Promise<ActionResult> {
  void _targetId;
  const participant = await requireParticipant(code);
  if (!participant) return { success: false, message: "Bergabung ke room terlebih dahulu." };
  return { success: true };
}

export async function submitSeerCheck(code: string, _targetId: string): Promise<ActionResult> {
  void _targetId;
  const participant = await requireParticipant(code);
  if (!participant) return { success: false, message: "Bergabung ke room terlebih dahulu." };
  return { success: true };
}

export async function submitDoctorProtect(code: string, _targetId: string): Promise<ActionResult> {
  void _targetId;
  const participant = await requireParticipant(code);
  if (!participant) return { success: false, message: "Bergabung ke room terlebih dahulu." };
  return { success: true };
}

export async function advanceWerewolfPhase(code: string): Promise<ActionResult> {
  try {
    await requireLeader(code);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal lanjut fase." };
  }
}

export async function submitWerewolfVote(code: string, _targetId: string): Promise<ActionResult> {
  void _targetId;
  const participant = await requireParticipant(code);
  if (!participant) return { success: false, message: "Bergabung ke room terlebih dahulu." };
  return { success: true };
}

export async function resolveWerewolfVoting(code: string): Promise<ActionResult> {
  try {
    await requireLeader(code);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Gagal resolve voting." };
  }
}
