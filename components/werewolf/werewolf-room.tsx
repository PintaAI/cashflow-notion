"use client";

import { type ReactNode, useEffect, useMemo, useRef, useTransition } from "react";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import confetti from "canvas-confetti";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiGameIcon,
  ArrowLeft01Icon,
  Clock01Icon,
  CogIcon,
  CopyLinkIcon,
  MegaphoneIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth-client";
import { useWerewolfRealtime } from "@/hooks/use-werewolf-realtime";
import {
  advanceWerewolfGame,
  createWerewolfGame,
  DEFAULT_WEREWOLF_CONTROL_MODE,
  getWerewolfRoomView,
  maybeAdvanceExpiredWerewolfGame,
  submitWerewolfGameKill,
  submitWerewolfGameSeerCheck,
  submitWerewolfGameVote,
  type WerewolfControlMode,
  type WerewolfGameState,
} from "@/lib/werewolf/game-state";
import {
  advanceWerewolfPhase,
  getWerewolfRoomState,
  joinWerewolfRoom,
  resolveWerewolfVoting,
  startWerewolfGame,
  submitSeerCheck,
  submitWerewolfKillTarget,
  submitWerewolfVote,
  updateWerewolfPlayerLimit,
  updateWerewolfTimers,
} from "@/app/actions/werewolf";
import { applyDevRoomPatches, WerewolfDevTools } from "./werewolf-dev-tools";
import { useWerewolfRoomStore } from "./werewolf-room-store";
import { WerewolfRoleCard } from "./werewolf-card";

type RoomState = Awaited<ReturnType<typeof getWerewolfRoomState>>;

const LOBBY_POLL_MS = 8000;
const FINISHED_POLL_MS = 5000;
const ACTIVE_POLL_MS = 2500;

const roleCopy: Record<string, { title: string; hint: string }> = {
  Werewolf: { title: "Werewolf", hint: "Kenali sesama werewolf pada Malam 1. Kill baru dimulai pada Malam 2." },
  Seer: { title: "Seer", hint: "Periksa satu pemain tiap malam untuk mengetahui rolenya. Jangan ketahuan." },
  Villager: { title: "Warga", hint: "Cari werewolf dari diskusi dan pola voting." },
};

const phaseCopy: Record<string, string> = {
  Lobby: "Kumpulkan pemain dulu. Minimal 4 orang.",
  Night: "Malam tiba.",
  Day: "Siang hari. Diskusi, tuduh, dan vote pemain paling mencurigakan.",
  Voting: "Saatnya voting. Pilih pemain hidup yang paling mencurigakan.",
  Revote: "Revote! Pilih di antara pemain yang seri.",
  Finished: "Game selesai. Semua role dibuka.",
};

function getImmersivePhaseTheme(status: string) {
  if (status === "Night") return "dark";
  if (status === "Day" || status === "Voting" || status === "Revote") return "light";
  return null;
}

function getPollingDelay(state: RoomState) {
  if (!state) return LOBBY_POLL_MS;
  if (!state.isJoined) return LOBBY_POLL_MS;
  if (state.status === "Lobby") return LOBBY_POLL_MS;
  if (state.status === "Finished") return FINISHED_POLL_MS;
  return ACTIVE_POLL_MS;
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const rest = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function phaseDurationSeconds(status: string, room: Pick<NonNullable<RoomState>, "nightSeconds" | "daySeconds" | "votingSeconds" | "revoteSeconds">) {
  if (status === "Night") return room.nightSeconds;
  if (status === "Day") return room.daySeconds;
  if (status === "Revote") return room.revoteSeconds;
  return 0;
}

function nextPhaseEndsAt(status: string, room: Pick<NonNullable<RoomState>, "nightSeconds" | "daySeconds" | "votingSeconds" | "revoteSeconds">) {
  const seconds = phaseDurationSeconds(status, room);
  return seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null;
}

function roleLabel(role: string | null) {
  if (!role) return "";
  return roleCopy[role]?.title ?? role;
}

function phaseTitle(status: string, phaseNumber: number) {
  const dayNumber = Math.max(1, phaseNumber);
  if (status === "Lobby") return "Kumpulkan desa dulu.";
  if (status === "Night") return `Malam ke-${dayNumber}`;
  if (status === "Day") return `Siang hari ke-${dayNumber}`;
  if (status === "Revote") return `Revote hari ke-${dayNumber}`;
  if (status === "Finished") return "Game selesai.";
  return status;
}

function PhasePanel({ finishedReason, children }: { finishedReason?: string | null; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-4 sm:p-5">
      {finishedReason && <p className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm font-semibold text-primary">{finishedReason}</p>}
      {children}
    </div>
  );
}

type WerewolfPlayerListItem = {
  id: string;
  name: string;
  isLeader?: boolean;
  isModerator?: boolean;
  isAlive: boolean;
  role?: string | null;
  eliminatedSource?: string | null;
  voteCount?: number;
  hasVoted?: boolean;
};

function WerewolfPlayerList({
  players,
  status,
  selectedId,
  onSelect,
  disabled,
  isPlayerDisabled,
  hideLifeStatus,
  emptyText = "Tidak ada pemain.",
}: {
  players: WerewolfPlayerListItem[];
  status?: string;
  selectedId?: string | null;
  onSelect?: (player: WerewolfPlayerListItem) => void;
  disabled?: boolean;
  isPlayerDisabled?: (player: WerewolfPlayerListItem) => boolean;
  hideLifeStatus?: boolean;
  emptyText?: string;
}) {
  if (players.length === 0) return <p className="rounded-md bg-background p-3 text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <div className="space-y-2">
      {players.map((player) => {
        const selected = selectedId === player.id;
        const playerDisabled = disabled || isPlayerDisabled?.(player) || false;
        const showLifeStatus = !hideLifeStatus || player.isModerator;
        const statusLabel = player.isModerator
          ? "Moderator"
          : showLifeStatus && !player.isAlive && player.eliminatedSource === "Vote"
            ? "Tervoting"
            : showLifeStatus && !player.isAlive && player.eliminatedSource === "Werewolf"
              ? "Korban malam"
              : showLifeStatus
                ? player.isAlive ? "Hidup" : "Gugur"
                : "Pemain";
        const content = (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold">{player.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${player.isModerator ? "bg-primary/10 text-primary" : showLifeStatus && player.isAlive ? "bg-emerald-500/10 text-emerald-600" : showLifeStatus && player.eliminatedSource === "Vote" ? "bg-red-500/10 text-red-600" : showLifeStatus && player.eliminatedSource === "Werewolf" ? "bg-zinc-900/10 text-zinc-700 dark:bg-zinc-100/10 dark:text-zinc-300" : showLifeStatus ? "bg-muted text-muted-foreground" : "bg-background text-muted-foreground"}`}>{statusLabel}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {player.isLeader !== undefined && <span>{player.isModerator ? "Moderator" : player.isLeader ? "Host" : "Pemain"}</span>}
              {player.role && <span className="font-semibold text-foreground">· {roleLabel(player.role)}</span>}
              {(status === "Day" || status === "Voting" || status === "Revote") && player.isAlive && player.hasVoted !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${player.hasVoted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{player.hasVoted ? "Sudah vote" : "Belum vote"}</span>
              )}
              {status !== "Day" && player.voteCount !== undefined && player.voteCount > 0 && <span>{player.voteCount} vote</span>}
            </div>
          </>
        );

        const className = `rounded-md border p-3 text-left transition-colors ${showLifeStatus && !player.isAlive ? "opacity-60" : ""} ${selected ? "border-primary bg-primary/10 text-primary" : "bg-background hover:border-primary/40"}`;

        return onSelect ? (
          <button key={player.id} type="button" onClick={() => onSelect(player)} disabled={playerDisabled} className={`w-full disabled:cursor-not-allowed disabled:opacity-45 ${className}`}>
            {content}
          </button>
        ) : (
          <div key={player.id} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function WerewolfRoom({ code }: { code: string }) {
  const {
    rawState,
    gameState,
    devPatches,
    loaded,
    name,
    message,
    copied,
    now,
    playerLimitInput,
    nightInput,
    dayInput,
    revoteInput,
    setDevPatches,
    setGameState,
    updateGameState,
    setName,
    setMessage,
    setCopied,
    setNow,
    setPlayerLimitInput,
    setNightInput,
    setDayInput,
    setRevoteInput,
    applyRoomState,
    resetRoomUi,
  } = useWerewolfRoomStore(
    useShallow((store) => ({
      rawState: store.rawState,
      gameState: store.gameState,
      devPatches: store.devPatches,
      loaded: store.loaded,
      name: store.name,
      message: store.message,
      copied: store.copied,
      now: store.now,
      playerLimitInput: store.playerLimitInput,
      nightInput: store.nightInput,
      dayInput: store.dayInput,
      revoteInput: store.revoteInput,
      setDevPatches: store.setDevPatches,
      setGameState: store.setGameState,
      updateGameState: store.updateGameState,
      setName: store.setName,
      setMessage: store.setMessage,
      setCopied: store.setCopied,
      setNow: store.setNow,
      setPlayerLimitInput: store.setPlayerLimitInput,
      setNightInput: store.setNightInput,
      setDayInput: store.setDayInput,
      setRevoteInput: store.setRevoteInput,
      applyRoomState: store.applyRoomState,
      resetRoomUi: store.resetRoomUi,
    })),
  );
  const hasDevPatches = Object.keys(devPatches).length > 0;
  const hasDevPatchesRef = useRef(false);
  const originalThemeRef = useRef<{ hadDark: boolean; hadLight: boolean; colorScheme: string } | null>(null);
  useEffect(() => { hasDevPatchesRef.current = hasDevPatches; }, [hasDevPatches]);

  const devRoomState = useMemo(
    () => hasDevPatches ? (applyDevRoomPatches(rawState as unknown as Record<string, unknown> | null, devPatches, gameState) as NonNullable<RoomState> | null) : rawState,
    [devPatches, gameState, hasDevPatches, rawState],
  );
  const state = useMemo(
    () => devRoomState ? getWerewolfRoomView(devRoomState, gameState) : null,
    [devRoomState, gameState],
  );
  const immersivePhaseStatus = state?.status;

  useEffect(() => {
    if (!immersivePhaseStatus) return;

    const root = document.documentElement;
    originalThemeRef.current ??= {
      hadDark: root.classList.contains("dark"),
      hadLight: root.classList.contains("light"),
      colorScheme: root.style.colorScheme,
    };

    const restoreTheme = () => {
      const original = originalThemeRef.current;
      if (!original) return;
      root.classList.toggle("dark", original.hadDark);
      root.classList.toggle("light", original.hadLight);
      root.style.colorScheme = original.colorScheme;
    };

    const phaseTheme = getImmersivePhaseTheme(immersivePhaseStatus);
    if (!phaseTheme) {
      restoreTheme();
      return;
    }

    root.classList.toggle("dark", phaseTheme === "dark");
    root.classList.toggle("light", phaseTheme === "light");
    root.style.colorScheme = phaseTheme;

    return restoreTheme;
  }, [immersivePhaseStatus]);

  const didInitTimers = useRef(false);
  const lastDevAutoResolveKey = useRef<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { data: session, isPending: sessionPending } = useSession();
  const isGuest = !sessionPending && !session;
  const shareUrl = useMemo(() => (typeof window === "undefined" ? "" : `${window.location.origin}/werewolf-multiplayer/${code}`), [code]);
  const realtime = useWerewolfRealtime(
    code,
    () => {
      if (!hasDevPatchesRef.current) void refresh();
    },
    (event) => setGameState(event.game),
  );

  useEffect(() => {
    didInitTimers.current = false;
    resetRoomUi();
  }, [code, resetRoomUi]);

  function publishGame(game: WerewolfGameState | null) {
    if (game) realtime.publishGameState(game);
  }

  useEffect(() => {
    let active = true;
    let loading = false;
    let timeout: number | undefined;
    let latestState: RoomState = null;

    const scheduleNextLoad = () => {
      if (!active || document.hidden || realtime.enabled) return;
      const delay = getPollingDelay(latestState);
      timeout = window.setTimeout(() => void loadState(), delay);
    };

    const loadState = async () => {
      if (loading || document.hidden) return;
      if (hasDevPatchesRef.current) { scheduleNextLoad(); return; }
      loading = true;
      try {
        const nextState = await getWerewolfRoomState(code);
        if (active) {
          latestState = nextState;
          applyRoomState(nextState, { initializeTimers: !didInitTimers.current });
          if (nextState) {
            if (!didInitTimers.current && nextState.status === "Lobby") {
              didInitTimers.current = true;
            }
          }
        }
      } finally {
        loading = false;
        if (!realtime.enabled) scheduleNextLoad();
      }
    };

    const handleVisibilityChange = () => {
      if (timeout) window.clearTimeout(timeout);
      if (!document.hidden) void loadState();
    };

    void loadState();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      active = false;
      if (timeout) window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [applyRoomState, code, realtime.enabled]);

  useEffect(() => {
    if (!state?.phaseEndsAt) return;
    if (state.status === "Lobby" || state.status === "Finished") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [setNow, state?.phaseEndsAt, state?.status]);

  useEffect(() => {
    if (state?.status !== "Finished") return;
    const duration = 3000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: ["#f59e0b", "#ef4444", "#f97316"] });
      confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: ["#f59e0b", "#ef4444", "#f97316"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [state?.status]);

  useEffect(() => {
    if (!realtime.enabled || hasDevPatches || !rawState || !state?.isLeader || !gameState?.phaseEndsAt) return;
    if ((gameState.controlMode ?? DEFAULT_WEREWOLF_CONTROL_MODE) === "Moderator") return;
    if (gameState.status === "Lobby" || gameState.status === "Finished") return;
    const delay = Math.max(0, new Date(gameState.phaseEndsAt).getTime() - Date.now()) + 300;
    const timer = window.setTimeout(async () => {
      const next = updateGameState((game, room) => (game && room ? maybeAdvanceExpiredWerewolfGame(game, room) : game));
      publishGame(next);
    }, delay);
    return () => window.clearTimeout(timer);
    // updateGameState reads the latest store snapshot; depending on its identity would reschedule every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.controlMode, gameState?.phaseEndsAt, gameState?.status, hasDevPatches, rawState, realtime.enabled, state?.isLeader]);

  useEffect(() => {
    if (!hasDevPatches || !state?.phaseEndsAt) return;
    if ((state.controlMode ?? DEFAULT_WEREWOLF_CONTROL_MODE) === "Moderator") return;
    if (state.status === "Lobby" || state.status === "Finished") return;
    if (Date.now() < new Date(state.phaseEndsAt).getTime()) return;

    const key = `${state.status}-${state.phaseNumber}-${state.currentVoteRound}-${state.phaseEndsAt}`;
    if (lastDevAutoResolveKey.current === key) return;
    lastDevAutoResolveKey.current = key;
    devResolveCurrentPhase();
    // The resolver reads the current patched state; rerunning this effect for every
    // resolver identity change would immediately retrigger phase transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDevPatches, now, state?.controlMode, state?.currentVoteRound, state?.phaseEndsAt, state?.phaseNumber, state?.status]);

  async function refresh() {
    const nextState = await getWerewolfRoomState(code);
    applyRoomState(nextState);
  }

  function runAction(
    actionName: string,
    action: () => Promise<{ success: boolean; message?: string }>,
    onSuccess?: () => WerewolfGameState | null | void,
  ) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      if (!result.success) setMessage(result.message ?? "Aksi gagal.");
      await refresh();
      if (result.success) {
        const nextGame = onSuccess?.() ?? null;
        if (nextGame) realtime.publishGameState(nextGame);
        realtime.publish(actionName);
      }
    });
  }

  function mutateGame(updater: (game: WerewolfGameState, room: NonNullable<typeof state>) => WerewolfGameState) {
    return updateGameState((game, room) => (game && room ? updater(game, room as NonNullable<typeof state>) : game));
  }

  function updateControlMode(nextMode: WerewolfControlMode) {
    const nextGame = mutateGame((game, room) => {
      const existingEnd = game.phaseEndsAt ? new Date(game.phaseEndsAt).getTime() : 0;
      const shouldKeepTimer = nextMode === "Auto" && existingEnd > Date.now();
      return {
        ...game,
        controlMode: nextMode,
        phaseEndsAt: nextMode === "Moderator" ? null : shouldKeepTimer ? game.phaseEndsAt : nextPhaseEndsAt(game.status, room),
        updatedAt: Date.now(),
      };
    });
    if (nextGame) realtime.publishGameState(nextGame);
    realtime.publish("control_mode");
  }

  function startDevGame() {
    if (!state) return null;
    const roleOverrides = new Map<string, string | null>();
    for (const participant of devPatches.mockParticipants ?? []) roleOverrides.set(participant.id, participant.role ?? null);
    for (const [id, override] of Object.entries(devPatches.participantOverrides ?? {})) {
      if (override.role !== undefined) roleOverrides.set(id, override.role);
    }

    const game = createWerewolfGame(state);
    const nextGame = {
      ...game,
      participants: game.participants.map((participant) => {
        const role = roleOverrides.get(participant.id);
        return role === "Werewolf" || role === "Seer" || role === "Villager" ? { ...participant, role } : participant;
      }),
      updatedAt: Date.now(),
    } satisfies WerewolfGameState;

    setGameState(nextGame);
    setDevPatches((prev) => ({ ...prev, mockParticipants: undefined }));
    realtime.publishGameState(nextGame);
    realtime.publish("start_game");
    return nextGame;
  }

  function devResolveCurrentPhase() {
    if (!hasDevPatches || !state) return false;
    const next = mutateGame((game, room) => advanceWerewolfGame(game, room));
    publishGame(next);
    realtime.publish(state.status === "Day" || state.status === "Voting" || state.status === "Revote" ? "resolve_voting" : "advance_phase");
    return Boolean(next);
  }

  function toggleDevTimerFreeze() {
    if (!state) return;
    const nextGame = mutateGame((game, room) => ({
      ...game,
      phaseEndsAt: game.phaseEndsAt ? null : nextPhaseEndsAt(game.status, room),
      updatedAt: Date.now(),
    }));
    publishGame(nextGame);
    realtime.publish("timer_freeze");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (!loaded) {
    return <main className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">Memuat room...</main>;
  }

  if (!state) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
        <div className="max-w-sm rounded-2xl border bg-card p-5 text-center shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">Room tidak ditemukan</h1>
          <Button asChild className="mt-5"><Link href="/werewolf-multiplayer">Kembali</Link></Button>
        </div>
      </main>
    );
  }

  const playerParticipants = state.participants.filter((participant) => !participant.isModerator);
  const aliveParticipants = playerParticipants.filter((participant) => participant.isAlive);
  const playerCount = playerParticipants.length;
  const controlMode = state.controlMode ?? DEFAULT_WEREWOLF_CONTROL_MODE;
  const isModeratorMode = controlMode === "Moderator";
  const isOpeningNight = state.status === "Night" && state.phaseNumber === 1;
  const fellowWerewolfIds = new Set((state.fellowWerewolves ?? []).map((w) => w.id));
  const killTargets = state.myRole === "Werewolf" && !isOpeningNight ? aliveParticipants.filter((p) => p.id !== state.me?.id && !fellowWerewolfIds.has(p.id)) : [];
  const seerTargets = state.myRole === "Seer" ? aliveParticipants.filter((p) => p.id !== state.me?.id) : [];
  const voteTargets = state.status === "Day" || state.status === "Voting" ? aliveParticipants : [];
  const revoteCandidateIds = state.revoteCandidateIds ?? [];
  const revoteTargets = state.status === "Revote" ? aliveParticipants.filter((p) => revoteCandidateIds.includes(p.id)) : [];
  const currentSeerCheck = state.mySeerChecks?.find((c) => c.phaseNumber === state.phaseNumber);
  const secondsLeft = state.phaseEndsAt ? Math.max(0, Math.ceil((new Date(state.phaseEndsAt).getTime() - now) / 1000)) : 0;
  const realtimeLabel = realtime.status === "connected" ? "Live" : realtime.status === "error" ? "Offline" : realtime.status === "disabled" ? "Polling" : "Connect";
  const actionTargetIds = new Set(
    state.status === "Night" && state.myRole === "Werewolf" && !isOpeningNight
      ? killTargets.map((p) => p.id)
      : state.status === "Night" && state.myRole === "Seer" && !currentSeerCheck
        ? seerTargets.map((p) => p.id)
        : (state.status === "Day" || state.status === "Voting") && state.me?.isAlive && !state.me.isModerator
          ? voteTargets.map((p) => p.id)
          : state.status === "Revote" && state.me?.isAlive && !state.me.isModerator
            ? revoteTargets.map((p) => p.id)
            : [],
  );
  const selectedPlayerId = state.status === "Night" && state.myRole === "Werewolf"
    ? state.myKillTargetId
    : state.status === "Night" && state.myRole === "Seer"
      ? state.mySeerCheckTargetId
      : state.status === "Day" || state.status === "Voting" || state.status === "Revote"
        ? state.myVoteTargetId
        : null;
  const seerRevealedRoles = new Map((state.mySeerChecks ?? []).map((check) => [check.targetName, check.inspectedRole]));
  const visiblePlayers = state.participants.map((participant) => ({
    ...participant,
    eliminatedSource: !participant.isAlive && participant.name === state.lastEliminatedName ? state.lastEliminatedSource : null,
    role: participant.role
      ?? (participant.id === state.me?.id ? state.myRole : null)
      ?? (state.myRole === "Werewolf" && fellowWerewolfIds.has(participant.id) ? "Werewolf" : null)
      ?? (state.myRole === "Seer" ? seerRevealedRoles.get(participant.name) ?? null : null),
  }));
  const phasePlayerList = (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-4" />
          Pemain
        </h3>
        <span className="text-xs text-muted-foreground">
          {actionTargetIds.size > 0 ? "Pilih dari sini" : `${state.aliveCount} hidup`}
        </span>
      </div>
      <WerewolfPlayerList
        players={visiblePlayers}
        status={state.status}
        selectedId={selectedPlayerId}
        disabled={isPending}
        hideLifeStatus={
          !state.me?.isModerator
          && !(state.status === "Night" && state.myRole === "Villager")
          && state.status !== "Day"
          && state.status !== "Voting"
          && state.status !== "Revote"
          && state.status !== "Finished"
        }
        isPlayerDisabled={(player) => actionTargetIds.size > 0 ? !actionTargetIds.has(player.id) : true}
        onSelect={actionTargetIds.size > 0 ? selectPlayerAction : undefined}
      />
      {state.status === "Finished" && state.werewolfCount !== null && (
        <p className="text-xs text-muted-foreground">Total werewolf: <span className="font-semibold text-foreground">{state.werewolfCount}</span></p>
      )}
    </div>
  );
  const storytellerPanel = state.me?.isModerator && state.status !== "Lobby" ? (
    <div className="rounded-md border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
      <div className="flex items-center gap-2 font-bold">
        <HugeiconsIcon icon={MegaphoneIcon} strokeWidth={2} className="size-4" />
        Storyteller Notes
      </div>
      {state.lastEliminatedName ? (
        <p className="mt-2 text-primary/90">
          {state.lastEliminatedSource === "Vote" ? "Tervoting" : "Korban malam"}: <span className="font-bold">{state.lastEliminatedName}</span>
        </p>
      ) : (
        <p className="mt-2 text-primary/90">Belum ada eliminasi.</p>
      )}
    </div>
  ) : null;
  const voteRevealPanel = state.lastEliminatedSource === "Vote" && state.lastEliminatedName ? (
    <div className="overflow-hidden rounded-md border bg-card p-5 text-center text-card-foreground shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Hasil Voting</p>
      <p className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{state.lastEliminatedName}</p>
      <p className={`mt-2 text-sm font-bold sm:text-base ${state.lastEliminatedRole === "Werewolf" ? "text-destructive" : "text-primary"}`}>
        {state.lastEliminatedRole === "Werewolf" ? "adalah Werewolf!" : "bukan Werewolf."}
      </p>
      {state.lastEliminatedRole && state.lastEliminatedRole !== "Werewolf" && (
        <p className="mt-1 text-xs text-muted-foreground">Role: {roleLabel(state.lastEliminatedRole)}.</p>
      )}
    </div>
  ) : null;

  function selectPlayerAction(player: WerewolfPlayerListItem) {
    if (!state) return;
    if (!actionTargetIds.has(player.id)) return;
    if (state.status === "Night" && state.myRole === "Werewolf") {
      if (hasDevPatches && state.me?.id) {
        const nextGame = mutateGame((game) => submitWerewolfGameKill(game, state.me!.id, player.id));
        publishGame(nextGame);
        realtime.publish("kill_target");
        return;
      }
      runAction("kill_target", () => submitWerewolfKillTarget(code, player.id), () => state.me ? mutateGame((game) => submitWerewolfGameKill(game, state.me!.id, player.id)) : null);
      return;
    }
    if (state.status === "Night" && state.myRole === "Seer") {
      if (currentSeerCheck) return;
      if (hasDevPatches && state.me?.id) {
        const nextGame = mutateGame((game) => submitWerewolfGameSeerCheck(game, state.me!.id, player.id));
        publishGame(nextGame);
        realtime.publish("seer_check");
        return;
      }
      runAction("seer_check", () => submitSeerCheck(code, player.id), () => state.me ? mutateGame((game) => submitWerewolfGameSeerCheck(game, state.me!.id, player.id)) : null);
      return;
    }
    if (state.status === "Day" || state.status === "Voting" || state.status === "Revote") {
      if (hasDevPatches && state.me?.id) {
        const nextGame = mutateGame((game, room) => {
          const voted = submitWerewolfGameVote(game, state.me!.id, player.id);
          const votedCount = Object.keys(voted.votes).filter((voterId) => voted.participants.some((participant) => participant.id === voterId && participant.isAlive)).length;
          return votedCount >= room.totalAliveVoters ? advanceWerewolfGame(voted, room) : voted;
        });
        publishGame(nextGame);
        realtime.publish("vote");
        return;
      }
      runAction("vote", () => submitWerewolfVote(code, player.id), () => state.me ? mutateGame((game, room) => {
        const voted = submitWerewolfGameVote(game, state.me!.id, player.id);
        const votedCount = Object.keys(voted.votes).filter((voterId) => voted.participants.some((participant) => participant.id === voterId && participant.isAlive)).length;
        return votedCount >= room.totalAliveVoters ? advanceWerewolfGame(voted, room) : voted;
      }) : null);
    }
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl space-y-5 px-4 pt-4 pb-24 sm:pt-8 sm:pb-28">
        <div className="mb-2 sm:mb-4">
          <div className="py-3 sm:py-4">
            <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon-xs" className="shrink-0">
                  <Link href="/werewolf-multiplayer" aria-label="Kembali ke Werewolf">
                    <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />
                  </Link>
                </Button>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
                  Werewolf Room
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden items-center gap-1 sm:inline-flex">
                  <HugeiconsIcon icon={UserGroupIcon} size={14} className="text-muted-foreground" />
                  <span className="font-medium text-muted-foreground/70">{playerCount}/{state.playerLimit}</span>
                </span>
                <span className="hidden sm:inline">pemain</span>
                <span className="mx-0.5 hidden text-muted-foreground/40 sm:inline">|</span>
                <span className="hidden items-center gap-1 sm:inline-flex">
                  <HugeiconsIcon icon={Clock01Icon} size={14} className="text-muted-foreground" />
                  <span className="font-medium text-muted-foreground/70">{isModeratorMode ? "Manual" : `${state.nightSeconds}s/${state.daySeconds}s`}</span>
                </span>
                <span className={`sm:inline-flex sm:items-center sm:gap-1 sm:rounded-full sm:border sm:px-2 sm:py-0.5 sm:text-[10px] sm:font-semibold ${realtime.status === "connected" ? "sm:border-green-500/30 sm:bg-green-500/10 sm:text-green-600 dark:sm:text-green-400" : realtime.status === "error" ? "sm:border-destructive/30 sm:bg-destructive/10 sm:text-destructive" : "sm:border-border sm:bg-background sm:text-muted-foreground"}`}>
                  <span className={`inline-block size-2 rounded-full sm:size-1.5 ${realtime.status === "connected" ? "bg-green-500" : realtime.status === "error" ? "bg-destructive" : "bg-muted-foreground/50"}`} />
                  <span className="hidden sm:inline">{realtimeLabel}</span>
                </span>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon-xs" className="size-6 sm:h-6 sm:w-auto sm:gap-1 sm:rounded-full sm:px-2 sm:text-[11px]">
                      <HugeiconsIcon icon={CogIcon} strokeWidth={2} className="size-3" />
                      <span className="hidden sm:inline">Setting</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Setting Room</DialogTitle>
                      <DialogDescription>Kelola timer, limit pemain, dan link room Werewolf ini.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
                            <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-4" />
                            Timer
                          </h2>
                          <span className="text-xs text-muted-foreground">{state.status}</span>
                        </div>
                        {state.isLeader && state.status === "Lobby" && !isModeratorMode ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="space-y-1.5 text-xs text-muted-foreground">Malam<Input type="number" min={15} max={300} value={nightInput} onChange={(e) => setNightInput(Number(e.target.value))} className="h-9 bg-background" /></label>
                            <label className="space-y-1.5 text-xs text-muted-foreground">Siang<Input type="number" min={30} max={600} value={dayInput} onChange={(e) => setDayInput(Number(e.target.value))} className="h-9 bg-background" /></label>
                            <label className="space-y-1.5 text-xs text-muted-foreground">Revote<Input type="number" min={10} max={120} value={revoteInput} onChange={(e) => setRevoteInput(Number(e.target.value))} className="h-9 bg-background" /></label>
                            <Button variant="outline" onClick={() => runAction("update_timers", () => updateWerewolfTimers(code, { nightSeconds: nightInput, daySeconds: dayInput, revoteSeconds: revoteInput }))} disabled={isPending} className="h-9 sm:col-span-2">Simpan timer</Button>
                          </div>
                        ) : (
                          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{isModeratorMode ? "Room moderator memakai kontrol fase manual tanpa timer." : "Timer hanya bisa diganti host room sebelum game dimulai."}</p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
                            <HugeiconsIcon icon={AiGameIcon} strokeWidth={2} className="size-4" />
                            Kontrol Game
                          </h2>
                          <span className="text-xs text-muted-foreground">{controlMode === "Moderator" ? "Manual" : "Auto"}</span>
                        </div>
                        {state.isLeader && state.status !== "Lobby" && state.status !== "Finished" ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Button
                              type="button"
                              variant={controlMode === "Auto" ? "default" : "outline"}
                              onClick={() => updateControlMode("Auto")}
                              disabled={isPending || controlMode === "Auto"}
                              className="h-auto min-h-11 flex-col items-start gap-0.5 px-3 py-2 text-left"
                            >
                              <span>Sistem otomatis</span>
                              <span className="text-[10px] font-normal opacity-75">Timer lanjut fase sendiri.</span>
                            </Button>
                            <Button
                              type="button"
                              variant={controlMode === "Moderator" ? "default" : "outline"}
                              onClick={() => updateControlMode("Moderator")}
                              disabled={isPending || controlMode === "Moderator"}
                              className="h-auto min-h-11 flex-col items-start gap-0.5 px-3 py-2 text-left"
                            >
                              <span>Kontrol manual</span>
                              <span className="text-[10px] font-normal opacity-75">Host room lanjutkan fase manual.</span>
                            </Button>
                          </div>
                        ) : (
                          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                            Mode kontrol bisa diganti host room setelah game dimulai.
                          </p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
                            <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-4" />
                            Pemain
                          </h2>
                          <span className="text-xs text-muted-foreground">{playerCount}/{state.playerLimit} pemain</span>
                        </div>
                        {state.isLeader && state.status === "Lobby" ? (
                          <div className="flex gap-2">
                            <Input type="number" min={4} max={16} value={playerLimitInput} onChange={(event) => setPlayerLimitInput(Number(event.target.value))} className="h-9 min-w-0 flex-1" />
                            <Button variant="outline" onClick={() => runAction("update_player_limit", () => updateWerewolfPlayerLimit(code, playerLimitInput))} disabled={isPending} className="h-9">Simpan limit</Button>
                          </div>
                        ) : null}
                        <div className="space-y-1.5">
                          {state.participants.map((participant) => (
                            <div key={participant.id} className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">{participant.name}</p>
                                <p className="text-[10px] text-muted-foreground">{participant.isModerator ? "Moderator" : participant.isLeader ? "Host" : participant.isAlive ? "Pemain" : "Gugur"}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
                            <HugeiconsIcon icon={CopyLinkIcon} strokeWidth={2} className="size-4" />
                            Link Room
                          </h2>
                          <span className="text-xs text-muted-foreground">{state.code}</span>
                        </div>
                        <Button className="h-11 w-full gap-2" onClick={copyLink}>
                          <HugeiconsIcon icon={CopyLinkIcon} strokeWidth={2} className="size-4" />
                          {copied ? "Link tersalin" : "Salin link room"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-3xl">
                  {phaseTitle(state.status, state.phaseNumber)}
                </h1>
                <p className="mt-1 max-w-2xl truncate text-xs text-muted-foreground/70 sm:text-sm">
                  {phaseCopy[state.status]}
                </p>
              </div>
              {secondsLeft > 0 && (
                <div className="rounded-full border border-border bg-background px-3 py-2 text-sm font-black tabular-nums shadow-sm sm:text-base">
                  {formatTime(secondsLeft)}
                </div>
              )}
            </div>
          </div>
        </div>

        {!state.isJoined ? (
          <section className="mx-auto flex max-w-md flex-col gap-4 rounded-md border bg-muted/30 p-4 text-center sm:p-5">
            <p className="text-xs font-medium text-muted-foreground">Gabung room {state.code}</p>
            <h2 className="text-2xl font-bold tracking-tight">{isGuest ? "Pakai nama dulu, baru masuk desa." : "Gabung dengan akunmu."}</h2>
            {session && <p className="text-sm text-muted-foreground">Kamu masuk sebagai {session.user.name || session.user.email}.</p>}
            {isGuest && <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama display" className="h-9 bg-background text-center" />}
            <Button onClick={() => runAction("join", () => joinWerewolfRoom(code, name))} disabled={isPending} className="h-9">Gabung Room</Button>
          </section>
        ) : (
          <div className="space-y-4">
            <section className="space-y-4">
              {storytellerPanel}
              {voteRevealPanel}

              {state.status === "Lobby" && (
                <PhasePanel>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {playerCount < state.minPlayers ? <p className="text-xs text-muted-foreground">Butuh {state.minPlayers - playerCount} pemain lagi untuk mulai.</p> : <p className="text-xs text-muted-foreground">Semua siap. Host room bisa mulai kapan saja.</p>}
                    {state.isLeader && (
                      <Button onClick={() => { if (hasDevPatches && startDevGame()) return; runAction("start_game", () => startWerewolfGame(code), () => (rawState ? updateGameState(() => createWerewolfGame(rawState)) : null)); }} disabled={isPending || playerCount < state.minPlayers} className="hidden h-9 sm:inline-flex">
                        Mulai Game
                      </Button>
                    )}
                  </div>
                  {phasePlayerList}
                  {state.isLeader && (
                    <Button onClick={() => { if (hasDevPatches && startDevGame()) return; runAction("start_game", () => startWerewolfGame(code), () => (rawState ? updateGameState(() => createWerewolfGame(rawState)) : null)); }} disabled={isPending || playerCount < state.minPlayers} className="mt-3 inline-flex h-9 w-full sm:hidden">
                      Mulai Game
                    </Button>
                  )}
                </PhasePanel>
              )}

              {state.status === "Night" && (
                <PhasePanel>
                  {isOpeningNight && (
                    <p className="rounded-md bg-background p-3 text-sm text-muted-foreground">
                      Malam 1 adalah pembukaan lunak: desa masih utuh, werewolf hanya saling mengenali, dan kill dimulai pada Malam 2. Seer tetap bisa memeriksa satu pemain.
                    </p>
                  )}

                  {state.me?.isModerator && (
                    <div className="space-y-3 rounded-md border bg-background p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold">Aksi malam realtime</p>
                        <span className="text-xs text-muted-foreground">Moderator view</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                          <p className="text-xs font-semibold text-destructive">Werewolf</p>
                          {state.moderatorKillActions.length > 0 ? (
                            <div className="mt-2 space-y-1 text-xs">
                              {state.moderatorKillActions.map((action, index) => (
                                <p key={`${action.actorName}-${action.targetName}-${index}`}>
                                  <span className="font-semibold">{action.actorName}</span> menyerang <span className="font-semibold">{action.targetName}</span>
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-muted-foreground">Belum ada target.</p>
                          )}
                        </div>
                        <div className="rounded-md border border-primary/30 bg-primary/10 p-3">
                          <p className="text-xs font-semibold text-primary">Seer</p>
                          {state.moderatorSeerActions.length > 0 ? (
                            <div className="mt-2 space-y-1 text-xs">
                              {state.moderatorSeerActions.map((action, index) => (
                                <p key={`${action.actorName}-${action.targetName}-${index}`}>
                                  <span className="font-semibold">{action.actorName}</span> menerawang <span className="font-semibold">{action.targetName}</span> ({roleLabel(action.inspectedRole)})
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-muted-foreground">Belum ada penerawangan.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {state.me?.isModerator ? null : !state.me?.isAlive ? (
                    <p className="rounded-md bg-background/60 p-3 text-sm text-muted-foreground">Kamu sudah gugur. Tunggu sampai pagi.</p>
                  ) : state.myRole === "Werewolf" ? (
                    <div className="space-y-3">
                      {isOpeningNight ? (
                        <p className="rounded-md bg-background/60 p-3 text-sm text-muted-foreground">Belum ada kill pada Malam 1. Gunakan fase ini untuk mengenali rekan werewolf dan menunggu pagi.</p>
                      ) : (
                        <div className="overflow-hidden rounded-md border border-destructive/30 bg-card p-5 text-center text-card-foreground shadow-lg">
                          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">Aksi Werewolf</p>
                          <p className="mt-3 text-lg font-black leading-snug tracking-tight sm:text-2xl">
                            Pilih siapa yang akan kamu serang dan makan malam ini
                          </p>
                          {state.myKillTargetId && (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Target: <span className="font-semibold text-destructive">{aliveParticipants.find((p) => p.id === state.myKillTargetId)?.name}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : state.myRole === "Seer" ? (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-md border border-primary/30 bg-card p-5 text-center text-card-foreground shadow-lg">
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">Mata Batin</p>
                        <p className="mt-3 text-lg font-black leading-snug tracking-tight sm:text-2xl">pilih siapa yang mau kamu terawang</p>
                        {currentSeerCheck && <p className="mt-3 text-xs text-muted-foreground">Kamu memeriksa: <span className="font-semibold text-primary">{currentSeerCheck.targetName} ({roleLabel(currentSeerCheck.inspectedRole)})</span>. Pemeriksaan malam ini sudah digunakan.</p>}
                      </div>

                    </div>
                  ) : (
                    <p className="rounded-md bg-background/60 p-3 text-sm text-muted-foreground">Malam hari, tunggu sampai pagi.</p>
                  )}

                  {state.me?.isModerator && <p className="text-xs text-muted-foreground">{state.nightActionSubmitted ? "Aksi malam selesai." : "Menunggu aksi malam..."}</p>}
                  {phasePlayerList}
                </PhasePanel>
              )}

              {state.status === "Day" && (
                <PhasePanel>
                  {state.lastEliminatedSource === "Werewolf" && state.lastEliminatedName ? (
                    <div className="overflow-hidden rounded-md border border-destructive/30 bg-card p-5 text-center text-card-foreground shadow-lg">
                      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">Pembunuhan Malam</p>
                      <p className="mt-3 text-lg font-black leading-snug tracking-tight sm:text-2xl">
                        Werewolf berhasil menjalankan aksinya tadi malam dan membunuh{" "}
                        <span className="text-destructive">{state.lastEliminatedName}</span>
                      </p>
                      <p className="mt-3 text-xs text-muted-foreground">Diskusi, tuduh, lalu vote pemain paling mencurigakan.</p>
                    </div>
                  ) : state.phaseNumber === 1 ? null : isModeratorMode ? (
                    <div className="overflow-hidden rounded-md border border-secondary/30 bg-card p-5 text-center text-card-foreground shadow-lg">
                      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">Kisah Sang Moderator</p>
                      <p className="mt-3 text-lg font-black leading-snug tracking-tight sm:text-2xl">Dengarkan cerita moderator, lalu diskusi.</p>
                      <p className="mt-3 text-xs text-muted-foreground">Cari pemain paling mencurigakan dari cerita yang dibawakan, lalu vote.</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-border bg-card p-5 text-center text-card-foreground">
                      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">Pagi yang Tenang</p>
                      <p className="mt-3 text-lg font-black leading-snug tracking-tight sm:text-2xl">Tidak ada korban malam ini.</p>
                      <p className="mt-3 text-xs text-muted-foreground">Siang tiba. Diskusi dan vote pemain paling mencurigakan.</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Sudah vote: <span className="font-bold text-foreground">{state.votedCount}/{state.totalAliveVoters}</span></p>
                  {!state.me?.isModerator && <p className="rounded-md bg-background p-3 text-sm text-muted-foreground">{state.me?.isAlive ? "Pilih pemain dari daftar untuk vote." : "Pemain gugur tidak bisa vote."}</p>}
                  {phasePlayerList}
                </PhasePanel>
              )}

              {state.status === "Revote" && (
                <PhasePanel>
                  <p className="text-sm font-semibold">Pilih kandidat seri.</p>
                  <p className="text-xs text-muted-foreground">Sudah vote: <span className="font-bold text-foreground">{state.votedCount}/{state.totalAliveVoters}</span></p>
                  {!state.me?.isModerator && <p className="rounded-md bg-background p-3 text-sm text-muted-foreground">{state.me?.isAlive ? "Pilih dari daftar." : "Pemain gugur tidak bisa vote."}</p>}
                  {phasePlayerList}
                </PhasePanel>
              )}

              {state.status === "Finished" && (
                <PhasePanel>
                  {(() => {
                    const isWerewolfWin = state.finishedReason?.startsWith("Werewolf") ?? false;
                    const winPlayers = state.participants.filter(
                      (p) => isWerewolfWin ? p.role === "Werewolf" : p.role === "Villager" || p.role === "Seer",
                    );
                    const emoji = isWerewolfWin ? "🐺" : "🌾";
                    const teamLabel = isWerewolfWin ? "Werewolf" : "Warga Desa";
                    return (
                      <div className={`overflow-hidden rounded-md border p-6 text-center text-card-foreground shadow-lg ${isWerewolfWin ? "border-destructive/30 bg-card" : "border-secondary/30 bg-card"}`}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">Game Selesai</p>
                        <p className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                          {emoji} {state.finishedReason}
                        </p>
                        <div className="mx-auto mt-5 flex max-w-xs flex-wrap justify-center gap-1.5">
                          {winPlayers.map((p) => (
                            <span key={p.id} className={`rounded-full px-3 py-1 text-xs font-bold ${isWerewolfWin ? "bg-destructive/20 text-destructive" : "bg-secondary/20 text-secondary-foreground"}`}>
                              {p.name}
                            </span>
                          ))}
                        </div>
                        <p className="mt-4 text-[11px] text-muted-foreground">{teamLabel} ({winPlayers.length} pemain)</p>
                      </div>
                    );
                  })()}
                  {phasePlayerList}
                </PhasePanel>
              )}

              {state.isLeader && isModeratorMode && state.status !== "Lobby" && state.status !== "Finished" && (
                <div className="flex flex-wrap justify-end gap-2">
                  {state.status === "Night" && <Button onClick={() => { if (devResolveCurrentPhase()) return; runAction("advance_phase", () => advanceWerewolfPhase(code), () => mutateGame((game, room) => advanceWerewolfGame(game, room))); }} disabled={isPending}>Lanjut ke Siang</Button>}
                  {state.status === "Day" && <Button onClick={() => { if (devResolveCurrentPhase()) return; runAction("resolve_voting", () => resolveWerewolfVoting(code), () => mutateGame((game, room) => advanceWerewolfGame(game, room))); }} disabled={isPending}>Selesaikan Siang</Button>}
                  {(state.status === "Voting" || state.status === "Revote") && <Button onClick={() => { if (devResolveCurrentPhase()) return; runAction("resolve_voting", () => resolveWerewolfVoting(code), () => mutateGame((game, room) => advanceWerewolfGame(game, room))); }} disabled={isPending} variant="outline" className="bg-background">{state.status === "Revote" ? "Resolve Revote" : "Resolve Voting"}</Button>}
                </div>
              )}
            </section>

          </div>
        )}

        {message && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</p>}

        <div className="flex justify-end">
          <Button asChild variant="ghost" size="sm"><Link href="/werewolf-multiplayer">Room Baru</Link></Button>
        </div>
      </div>
      {state.myRole && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <WerewolfRoleCard role={state.myRole} className="pointer-events-auto shadow-lg" />
        </div>
      )}
      <WerewolfDevTools
        rawState={state as unknown as Record<string, unknown>}
        actualRoles={Object.fromEntries((gameState?.participants ?? []).map((participant) => [participant.id, participant.role]))}
        patches={devPatches}
        onPatch={setDevPatches}
        timerFrozen={Boolean(gameState && gameState.status !== "Lobby" && gameState.status !== "Finished" && !gameState.phaseEndsAt)}
        onToggleTimerFreeze={gameState && gameState.status !== "Lobby" && gameState.status !== "Finished" ? toggleDevTimerFreeze : undefined}
        onNextPhase={gameState && gameState.status !== "Lobby" && gameState.status !== "Finished" ? devResolveCurrentPhase : undefined}
      />
    </main>
  );
}
