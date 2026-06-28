export type WerewolfRoleName = "Werewolf" | "Seer" | "Doctor" | "Jester" | "Villager";
export type WerewolfPhase = "Lobby" | "Night" | "Day" | "Voting" | "Revote" | "Finished";
export type WerewolfControlMode = "Auto" | "Moderator";
export type WerewolfEliminationSource = "Werewolf" | "Vote";

export const DEFAULT_WEREWOLF_CONTROL_MODE: WerewolfControlMode = "Auto";

export type WerewolfParticipantMeta = {
  id: string;
  name: string;
  isLeader: boolean;
  isModerator: boolean;
  lastSeenAt: string;
};

export type WerewolfGameParticipant = WerewolfParticipantMeta & {
  role: WerewolfRoleName;
  isAlive: boolean;
};

export type WerewolfSeerCheckRecord = {
  actorId: string;
  targetId: string;
  phaseNumber: number;
  inspectedRole: WerewolfRoleName;
};

export type WerewolfGameState = {
  status: WerewolfPhase;
  controlMode: WerewolfControlMode;
  phaseNumber: number;
  phaseEndsAt: string | null;
  currentVoteRound: number;
  revoteCandidateIds: string[] | null;
  lastEliminatedId: string | null;
  lastEliminatedSource: WerewolfEliminationSource | null;
  finishedReason: string | null;
  participants: WerewolfGameParticipant[];
  nightActions: Record<string, string>;
  seerChecks: WerewolfSeerCheckRecord[];
  doctorActions: Record<string, string>;
  votes: Record<string, string>;
  updatedAt: number;
};

export type WerewolfRoomMeta = {
  code: string;
  playerLimit: number;
  availableRoles: WerewolfRoleName[];
  maxWerewolves: number;
  minPlayers: number;
  nightSeconds: number;
  daySeconds: number;
  votingSeconds: number;
  revoteSeconds: number;
  controlMode: WerewolfControlMode;
  isJoined: boolean;
  isLeader: boolean;
  me: { id: string; name: string; isAlive: boolean; isModerator: boolean } | null;
  participants: Array<WerewolfParticipantMeta & { isAlive: boolean; role: WerewolfRoleName | null; voteCount: number; hasVoted: boolean }>;
};

export type WerewolfRoomView = Omit<WerewolfRoomMeta, "participants"> & {
  status: WerewolfPhase;
  controlMode: WerewolfControlMode;
  phaseNumber: number;
  finishedReason: string | null;
  phaseEndsAt: string | null;
  currentVoteRound: number;
  myRole: WerewolfRoleName | null;
  fellowWerewolves: Array<{ id: string; name: string }> | null;
  mySeerChecks: Array<{ phaseNumber: number; targetName: string; inspectedRole: WerewolfRoleName }> | null;
  myKillTargetId: string | null;
  mySeerCheckTargetId: string | null;
  myProtectTargetId: string | null;
  myVoteTargetId: string | null;
  lastEliminatedName: string | null;
  lastEliminatedRole: WerewolfRoleName | null;
  lastEliminatedSource: WerewolfEliminationSource | null;
  aliveCount: number;
  werewolfCount: number | null;
  nightActionSubmitted: boolean;
  revoteCandidateIds: string[] | null;
  votedCount: number;
  totalAliveVoters: number;
  moderatorKillActions: Array<{ actorName: string; targetName: string }>;
  moderatorSeerActions: Array<{ actorName: string; targetName: string; inspectedRole: WerewolfRoleName }>;
  moderatorProtectActions: Array<{ actorName: string; targetName: string }>;
  participants: Array<WerewolfParticipantMeta & { isAlive: boolean; role: WerewolfRoleName | null; voteCount: number; hasVoted: boolean }>;
};

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function roleDeck(playerCount: number, availableRoles: WerewolfRoleName[], maxWerewolves: number): WerewolfRoleName[] {
  const roleSet = new Set(availableRoles);
  const werewolfCount = Math.max(1, Math.min(maxWerewolves, Math.floor(playerCount / 4), playerCount - 1));
  const specialRoles: WerewolfRoleName[] = ["Seer"];
  if (!roleSet.has("Seer")) specialRoles.pop();
  if (playerCount >= 5 && roleSet.has("Doctor")) specialRoles.push("Doctor");
  if (playerCount >= 7 && roleSet.has("Jester")) specialRoles.push("Jester");
  const villagerCount = Math.max(0, playerCount - werewolfCount - specialRoles.length);
  return shuffle([
    ...Array.from({ length: werewolfCount }, () => "Werewolf" as const),
    ...specialRoles,
    ...Array.from({ length: villagerCount }, () => "Villager" as const),
  ]);
}

function phaseEndsAt(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function winReason(participants: Pick<WerewolfGameParticipant, "role" | "isAlive">[]) {
  const alive = participants.filter((participant) => participant.isAlive);
  const werewolves = alive.filter((participant) => participant.role === "Werewolf").length;
  const villagers = alive.filter((participant) => participant.role !== "Werewolf" && participant.role !== "Jester").length;
  if (werewolves === 0) return "Warga menang. Semua werewolf sudah tersingkir.";
  if (werewolves >= villagers) return "Werewolf menang. Jumlah mereka sudah menguasai desa.";
  return null;
}

export function createWerewolfGame(meta: WerewolfRoomMeta): WerewolfGameState {
  const players = meta.participants.filter((participant) => !participant.isModerator);
  const roles = roleDeck(players.length, meta.availableRoles, meta.maxWerewolves);
  const controlMode = meta.controlMode ?? DEFAULT_WEREWOLF_CONTROL_MODE;
  return {
    status: "Night",
    controlMode,
    phaseNumber: 1,
    phaseEndsAt: controlMode === "Moderator" ? null : phaseEndsAt(meta.nightSeconds),
    currentVoteRound: 1,
    revoteCandidateIds: null,
    lastEliminatedId: null,
    lastEliminatedSource: null,
    finishedReason: null,
    participants: players.map((participant, index) => ({
      id: participant.id,
      name: participant.name,
      isLeader: participant.isLeader,
      isModerator: false,
      lastSeenAt: participant.lastSeenAt,
      isAlive: true,
      role: roles[index],
    })),
    nightActions: {},
    seerChecks: [],
    doctorActions: {},
    votes: {},
    updatedAt: Date.now(),
  };
}

export function syncGameParticipants(game: WerewolfGameState, meta: WerewolfRoomMeta): WerewolfGameState {
  const existing = new Map(game.participants.map((participant) => [participant.id, participant]));
  const players = meta.participants.filter((participant) => !participant.isModerator);
  return {
    ...game,
    participants: players.map((participant) => {
      const current = existing.get(participant.id);
      return current
        ? { ...current, name: participant.name, isLeader: participant.isLeader, isModerator: false, lastSeenAt: participant.lastSeenAt }
        : { ...participant, isModerator: false, isAlive: game.status === "Lobby", role: "Villager" };
    }),
  };
}

export function submitWerewolfGameKill(game: WerewolfGameState, actorId: string, targetId: string): WerewolfGameState {
  return { ...game, nightActions: { ...game.nightActions, [actorId]: targetId }, updatedAt: Date.now() };
}

export function submitWerewolfGameSeerCheck(game: WerewolfGameState, actorId: string, targetId: string): WerewolfGameState {
  const target = game.participants.find((participant) => participant.id === targetId);
  if (!target) return game;
  return {
    ...game,
    seerChecks: [
      ...game.seerChecks.filter((check) => !(check.actorId === actorId && check.phaseNumber === game.phaseNumber)),
      { actorId, targetId, phaseNumber: game.phaseNumber, inspectedRole: target.role },
    ],
    updatedAt: Date.now(),
  };
}

export function submitWerewolfGameDoctorProtect(game: WerewolfGameState, actorId: string, targetId: string): WerewolfGameState {
  return { ...game, doctorActions: { ...(game.doctorActions ?? {}), [actorId]: targetId }, updatedAt: Date.now() };
}

export function submitWerewolfGameVote(game: WerewolfGameState, voterId: string, targetId: string): WerewolfGameState {
  return { ...game, votes: { ...game.votes, [voterId]: targetId }, updatedAt: Date.now() };
}

export function resolveWerewolfNight(game: WerewolfGameState, daySeconds: number): WerewolfGameState {
  const isOpeningNight = game.phaseNumber === 1;
  const aliveWerewolfIds = new Set(game.participants.filter((p) => p.isAlive && p.role === "Werewolf").map((p) => p.id));
  const tally = new Map<string, number>();
  if (!isOpeningNight) {
    for (const [actorId, targetId] of Object.entries(game.nightActions)) {
      if (aliveWerewolfIds.has(actorId)) tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }
  }
  const topCount = tally.size ? Math.max(...tally.values()) : 0;
  const topTargets = [...tally.entries()].filter(([, count]) => count === topCount).map(([id]) => id);
  const protectedIds = new Set(
    Object.entries(game.doctorActions ?? {})
      .filter(([actorId]) => game.participants.some((p) => p.id === actorId && p.isAlive && p.role === "Doctor"))
      .map(([, targetId]) => targetId),
  );
  const targetId = topTargets[0] ?? null;
  const eliminatedId = targetId && !protectedIds.has(targetId) ? targetId : null;
  const participants = game.participants.map((participant) =>
    participant.id === eliminatedId ? { ...participant, isAlive: false } : participant,
  );
  const finishedReason = winReason(participants);
  return {
    ...game,
    status: finishedReason ? "Finished" : "Day",
    phaseEndsAt: finishedReason || game.controlMode === "Moderator" ? null : phaseEndsAt(daySeconds),
    lastEliminatedId: eliminatedId,
    lastEliminatedSource: eliminatedId ? "Werewolf" : null,
    finishedReason,
    participants,
    nightActions: {},
    doctorActions: {},
    currentVoteRound: 1,
    revoteCandidateIds: null,
    votes: {},
    updatedAt: Date.now(),
  };
}

export function resolveWerewolfVotes(game: WerewolfGameState, nightSeconds: number, revoteSeconds: number): WerewolfGameState {
  const aliveIds = new Set(game.participants.filter((p) => p.isAlive).map((p) => p.id));
  const tally = new Map<string, number>();
  for (const targetId of Object.values(game.votes)) {
    if (aliveIds.has(targetId)) tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
  }
  const topCount = tally.size ? Math.max(...tally.values()) : 0;
  const topTargets = [...tally.entries()].filter(([, count]) => count === topCount).map(([id]) => id);

  if (topTargets.length > 1 && game.currentVoteRound === 1) {
    return {
      ...game,
      status: "Revote",
      currentVoteRound: 2,
      revoteCandidateIds: topTargets,
      phaseEndsAt: game.controlMode === "Moderator" ? null : phaseEndsAt(revoteSeconds),
      votes: {},
      updatedAt: Date.now(),
    };
  }

  const canEliminate = topCount > 0 && topTargets.length === 1;
  const eliminatedId = canEliminate ? topTargets[0] : null;
  const eliminatedRole = eliminatedId ? game.participants.find((participant) => participant.id === eliminatedId)?.role ?? null : null;
  const participants = game.participants.map((participant) =>
    participant.id === eliminatedId ? { ...participant, isAlive: false } : participant,
  );
  const finishedReason = eliminatedRole === "Jester" ? "Jester menang. Dia berhasil membuat desa memvoting dirinya." : winReason(participants);
  return {
    ...game,
    status: finishedReason ? "Finished" : "Night",
    phaseNumber: finishedReason ? game.phaseNumber : game.phaseNumber + 1,
    currentVoteRound: 1,
    revoteCandidateIds: null,
    phaseEndsAt: finishedReason || game.controlMode === "Moderator" ? null : phaseEndsAt(nightSeconds),
    lastEliminatedId: eliminatedId,
    lastEliminatedSource: eliminatedId ? "Vote" : null,
    finishedReason,
    participants,
    votes: {},
    updatedAt: Date.now(),
  };
}

export function advanceWerewolfGame(game: WerewolfGameState, meta: WerewolfRoomMeta): WerewolfGameState {
  if (game.status === "Night") return resolveWerewolfNight(game, meta.daySeconds);
  if (game.status === "Day" || game.status === "Voting" || game.status === "Revote") return resolveWerewolfVotes(game, meta.nightSeconds, meta.revoteSeconds);
  return game;
}

export function maybeAdvanceExpiredWerewolfGame(game: WerewolfGameState, meta: WerewolfRoomMeta): WerewolfGameState {
  if ((game.controlMode ?? DEFAULT_WEREWOLF_CONTROL_MODE) === "Moderator") return game;
  if (!game.phaseEndsAt || game.status === "Lobby" || game.status === "Finished") return game;
  if (Date.now() < new Date(game.phaseEndsAt).getTime()) return game;
  return advanceWerewolfGame(game, meta);
}

export function getWerewolfRoomView(meta: WerewolfRoomMeta, game: WerewolfGameState | null): WerewolfRoomView {
  if (!game) {
    const players = meta.participants.filter((participant) => !participant.isModerator);
    return {
      ...meta,
      status: "Lobby",
      controlMode: meta.controlMode ?? DEFAULT_WEREWOLF_CONTROL_MODE,
      phaseNumber: 0,
      finishedReason: null,
      phaseEndsAt: null,
      currentVoteRound: 1,
      myRole: null,
      fellowWerewolves: null,
      mySeerChecks: null,
      myKillTargetId: null,
      mySeerCheckTargetId: null,
      myProtectTargetId: null,
      myVoteTargetId: null,
      lastEliminatedName: null,
      lastEliminatedRole: null,
      lastEliminatedSource: null,
      aliveCount: players.length,
      werewolfCount: null,
      nightActionSubmitted: false,
      revoteCandidateIds: null,
      votedCount: 0,
      totalAliveVoters: players.length,
      moderatorKillActions: [],
      moderatorSeerActions: [],
      moderatorProtectActions: [],
    };
  }

  const meId = meta.me?.id ?? null;
  const me = meId ? game.participants.find((participant) => participant.id === meId) ?? null : null;
  const moderatorMetas = meta.participants.filter((participant) => participant.isModerator);
  const aliveParticipants = game.participants.filter((participant) => participant.isAlive);
  const voteCounts = new Map<string, number>();
  for (const targetId of Object.values(game.votes)) voteCounts.set(targetId, (voteCounts.get(targetId) ?? 0) + 1);
  const showRoles = game.status === "Finished";
  const myRole = me?.role ?? null;
  const controlMode = game.controlMode ?? meta.controlMode ?? DEFAULT_WEREWOLF_CONTROL_MODE;
  const lastEliminated = game.lastEliminatedId ? game.participants.find((p) => p.id === game.lastEliminatedId) : null;
  const showEliminationSummary = meta.me?.isModerator || game.lastEliminatedSource === "Vote" || (game.lastEliminatedSource === "Werewolf" && (game.status === "Day" || game.status === "Finished"));
  const showEliminatedRole = meta.me?.isModerator || game.lastEliminatedSource === "Vote";
  const moderatorKillActions = meta.me?.isModerator
    ? Object.entries(game.nightActions).flatMap(([actorId, targetId]) => {
        const actor = game.participants.find((p) => p.id === actorId);
        const target = game.participants.find((p) => p.id === targetId);
        return actor && target ? [{ actorName: actor.name, targetName: target.name }] : [];
      })
    : [];
  const moderatorSeerActions = meta.me?.isModerator
    ? game.seerChecks
        .filter((check) => check.phaseNumber === game.phaseNumber)
        .flatMap((check) => {
          const actor = game.participants.find((p) => p.id === check.actorId);
          const target = game.participants.find((p) => p.id === check.targetId);
          return actor && target ? [{ actorName: actor.name, targetName: target.name, inspectedRole: check.inspectedRole }] : [];
        })
    : [];
  const moderatorProtectActions = meta.me?.isModerator
    ? Object.entries(game.doctorActions ?? {}).flatMap(([actorId, targetId]) => {
        const actor = game.participants.find((p) => p.id === actorId);
        const target = game.participants.find((p) => p.id === targetId);
        return actor && target ? [{ actorName: actor.name, targetName: target.name }] : [];
      })
    : [];

  return {
    ...meta,
    status: game.status,
    controlMode,
    phaseNumber: game.phaseNumber,
    finishedReason: game.finishedReason,
    phaseEndsAt: game.phaseEndsAt,
    currentVoteRound: game.currentVoteRound,
    me: me ? { id: me.id, name: me.name, isAlive: me.isAlive, isModerator: false } : meta.me,
    myRole: meta.me?.isModerator ? null : myRole,
    fellowWerewolves:
      !meta.me?.isModerator && myRole === "Werewolf" && game.status !== "Lobby"
        ? game.participants.filter((p) => p.isAlive && p.role === "Werewolf" && p.id !== meId).map((p) => ({ id: p.id, name: p.name }))
        : null,
    mySeerChecks:
      !meta.me?.isModerator && myRole === "Seer"
        ? game.seerChecks
            .filter((check) => check.actorId === meId)
            .map((check) => ({
              phaseNumber: check.phaseNumber,
              targetName: game.participants.find((p) => p.id === check.targetId)?.name ?? "Unknown",
              inspectedRole: check.inspectedRole,
            }))
        : null,
    myKillTargetId: !meta.me?.isModerator && myRole === "Werewolf" && game.status === "Night" && meId ? game.nightActions[meId] ?? null : null,
    mySeerCheckTargetId:
      !meta.me?.isModerator && myRole === "Seer" && game.status === "Night" && meId
        ? game.seerChecks.find((check) => check.actorId === meId && check.phaseNumber === game.phaseNumber)?.targetId ?? null
        : null,
    myProtectTargetId: !meta.me?.isModerator && myRole === "Doctor" && game.status === "Night" && meId ? (game.doctorActions ?? {})[meId] ?? null : null,
    myVoteTargetId: !meta.me?.isModerator && (game.status === "Day" || game.status === "Voting" || game.status === "Revote") && meId ? game.votes[meId] ?? null : null,
    lastEliminatedName: showEliminationSummary ? lastEliminated?.name ?? null : null,
    lastEliminatedRole: showEliminatedRole ? lastEliminated?.role ?? null : null,
    lastEliminatedSource: showEliminationSummary ? game.lastEliminatedSource ?? null : null,
    aliveCount: aliveParticipants.length,
    werewolfCount: showRoles ? game.participants.filter((participant) => participant.role === "Werewolf").length : null,
    nightActionSubmitted:
      game.status === "Night" &&
      (game.phaseNumber === 1 || game.participants.filter((p) => p.isAlive && p.role === "Werewolf").every((p) => Boolean(game.nightActions[p.id]))) &&
      !game.participants.some((p) => p.isAlive && p.role === "Seer" && !game.seerChecks.some((check) => check.actorId === p.id && check.phaseNumber === game.phaseNumber)) &&
      !game.participants.some((p) => p.isAlive && p.role === "Doctor" && !(game.doctorActions ?? {})[p.id]),
    revoteCandidateIds: game.revoteCandidateIds,
    votedCount: Object.keys(game.votes).filter((voterId) => game.participants.some((p) => p.id === voterId && p.isAlive)).length,
    totalAliveVoters: aliveParticipants.length,
    moderatorKillActions,
    moderatorSeerActions,
    moderatorProtectActions,
    participants: [
      ...moderatorMetas.map((participant) => ({
        ...participant,
        isAlive: true,
        role: null,
        voteCount: 0,
        hasVoted: false,
      })),
      ...game.participants.map((participant) => ({
        id: participant.id,
        name: participant.name,
        isLeader: participant.isLeader,
        isModerator: false,
        isAlive: participant.isAlive,
        role: showRoles || meta.me?.isModerator ? participant.role : null,
        voteCount: game.status === "Voting" || game.status === "Revote" ? voteCounts.get(participant.id) ?? 0 : 0,
        hasVoted: game.status === "Day" || game.status === "Voting" || game.status === "Revote" ? Boolean(game.votes[participant.id]) : false,
        lastSeenAt: participant.lastSeenAt,
      })),
    ],
  };
}
