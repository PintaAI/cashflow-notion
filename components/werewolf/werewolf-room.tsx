"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiGameIcon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  CopyLinkIcon,
  FireIcon,
  MegaphoneIcon,
  Moon02Icon,
  Sun02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth-client";
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
import { type WerewolfDevPatches, applyDevPatches, materializeDevPatches, WerewolfDevTools, shuffleRoles } from "./werewolf-dev-tools";

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
  Night: "Malam tiba. Tutup mata dan jalankan aksi sesuai rolemu.",
  Day: "Siang hari. Diskusi dan tuduh yang paling mencurigakan.",
  Voting: "Saatnya voting. Pilih pemain hidup yang paling mencurigakan.",
  Revote: "Revote! Pilih di antara pemain yang seri.",
  Finished: "Game selesai. Semua role dibuka.",
};

const phaseIcon: Record<string, typeof AiGameIcon> = {
  Lobby: AiGameIcon,
  Night: Moon02Icon,
  Day: Sun02Icon,
  Voting: FireIcon,
  Revote: AlertCircleIcon,
  Finished: CheckmarkCircle02Icon,
};

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

function roleLabel(role: string | null) {
  if (!role) return "";
  return roleCopy[role]?.title ?? role;
}

export function WerewolfRoom({ code }: { code: string }) {
  const [rawState, setRawState] = useState<RoomState>(null);
  const [devPatches, setDevPatches] = useState<WerewolfDevPatches>({});
  const hasDevPatches = Object.keys(devPatches).length > 0;
  const hasDevPatchesRef = useRef(false);
  useEffect(() => { hasDevPatchesRef.current = hasDevPatches; }, [hasDevPatches]);

  const state = useMemo(
    () => (hasDevPatches ? (applyDevPatches(rawState as unknown as Record<string, unknown>, devPatches) as RoomState) : rawState),
    [rawState, devPatches, hasDevPatches],
  );

  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [playerLimitInput, setPlayerLimitInput] = useState(10);
  const [nightInput, setNightInput] = useState(60);
  const [dayInput, setDayInput] = useState(120);
  const [votingInput, setVotingInput] = useState(60);
  const [revoteInput, setRevoteInput] = useState(30);
  const didInitTimers = useRef(false);
  const lastDevAutoResolveKey = useRef<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { data: session, isPending: sessionPending } = useSession();
  const isGuest = !sessionPending && !session;
  const shareUrl = useMemo(() => (typeof window === "undefined" ? "" : `${window.location.origin}/werewolf-multiplayer/${code}`), [code]);

  useEffect(() => {
    let active = true;
    let loading = false;
    let timeout: number | undefined;
    let latestState: RoomState = null;

    const scheduleNextLoad = () => {
      if (!active || document.hidden) return;
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
          setRawState(nextState);
          setLoaded(true);
          if (nextState) {
            setPlayerLimitInput(nextState.playerLimit);
            if (!didInitTimers.current && nextState.status === "Lobby") {
              setNightInput(nextState.nightSeconds);
              setDayInput(nextState.daySeconds);
              setVotingInput(nextState.votingSeconds);
              setRevoteInput(nextState.revoteSeconds);
              didInitTimers.current = true;
            }
          }
        }
      } finally {
        loading = false;
        scheduleNextLoad();
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
  }, [code]);

  useEffect(() => {
    if (!state?.phaseEndsAt) return;
    if (state.status === "Lobby" || state.status === "Finished") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state?.phaseEndsAt, state?.status]);

  useEffect(() => {
    if (!hasDevPatches || !state?.phaseEndsAt) return;
    if (state.status === "Lobby" || state.status === "Finished") return;
    if (Date.now() < new Date(state.phaseEndsAt).getTime()) return;

    const key = `${state.status}-${state.phaseNumber}-${state.currentVoteRound}-${state.phaseEndsAt}`;
    if (lastDevAutoResolveKey.current === key) return;
    lastDevAutoResolveKey.current = key;
    devResolveCurrentPhase();
    // The resolver reads the current patched state; rerunning this effect for every
    // resolver identity change would immediately retrigger phase transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDevPatches, now, state?.currentVoteRound, state?.phaseEndsAt, state?.phaseNumber, state?.status]);

  async function refresh() {
    const nextState = await getWerewolfRoomState(code);
    setRawState(nextState);
    setLoaded(true);
    if (nextState) setPlayerLimitInput(nextState.playerLimit);
  }

  function runAction(action: () => Promise<{ success: boolean; message?: string }>) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      if (!result.success) setMessage(result.message ?? "Aksi gagal.");
      await refresh();
    });
  }

  function devClick(updates: WerewolfDevPatches) {
    if (!hasDevPatches) return false;
    setDevPatches((prev) => materializeDevPatches({ ...prev, ...updates }));
    return true;
  }

  function getDevParticipantRole(participantId: string) {
    return devPatches.mockParticipants?.find((p) => p.id === participantId)?.role
      ?? devPatches.participantOverrides?.[participantId]?.role
      ?? null;
  }

  function devSeerCheck(target: { id: string; name: string }) {
    const phaseNumber = state?.phaseNumber ?? 1;
    const currentChecks = devPatches.mySeerChecks ?? state?.mySeerChecks ?? [];
    if (currentChecks.some((check) => check.phaseNumber === phaseNumber)) return true;

    const inspectedRole = getDevParticipantRole(target.id);
    if (!inspectedRole) return devClick({ mySeerCheckTargetId: target.id });

    return devClick({
      mySeerCheckTargetId: target.id,
      mySeerChecks: [
        ...currentChecks.filter((check) => check.phaseNumber !== phaseNumber),
        { phaseNumber, targetName: target.name, inspectedRole },
      ],
    });
  }

  function getDevPhaseEndsAt(seconds: number) {
    return new Date(Date.now() + seconds * 1000).toISOString();
  }

  function devResolveCurrentPhase() {
    if (!hasDevPatches || !state) return false;

    if (state.status === "Night") {
      const isOpeningNight = state.phaseNumber === 1;
      const targetId = isOpeningNight ? null : state.myKillTargetId;
      const target = targetId ? state.participants.find((p) => p.id === targetId) : null;
      const participantOverrides = { ...(devPatches.participantOverrides ?? {}) };
      const mockParticipants = (devPatches.mockParticipants ?? []).map((m) =>
        m.id === targetId ? { ...m, isAlive: false } : m,
      );

      if (targetId && !mockParticipants.some((m) => m.id === targetId)) {
        participantOverrides[targetId] = { ...participantOverrides[targetId], isAlive: false };
      }

      setDevPatches((prev) => materializeDevPatches({
        ...prev,
        status: "Day",
        phaseEndsAt: getDevPhaseEndsAt(state.daySeconds || 120),
        phaseEndsAtOffset: undefined,
        lastEliminatedName: target?.name ?? null,
        myKillTargetId: null,
        mySeerCheckTargetId: null,
        nightActionSubmitted: false,
        aliveCount: state.participants.filter((p) => p.isAlive && p.id !== targetId).length,
        participantOverrides,
        mockParticipants,
      }));
      return true;
    }

    if (state.status === "Day") {
      setDevPatches((prev) => materializeDevPatches({
        ...prev,
        status: "Voting",
        currentVoteRound: 1,
        phaseEndsAt: getDevPhaseEndsAt(state.votingSeconds || 60),
        phaseEndsAtOffset: undefined,
        myVoteTargetId: null,
        votedCount: 0,
        revoteCandidateIds: null,
      }));
      return true;
    }

    if (state.status === "Voting" || state.status === "Revote") {
      setDevPatches((prev) => materializeDevPatches({
        ...prev,
        status: "Night",
        phaseNumber: Math.max(1, state.phaseNumber + 1),
        currentVoteRound: 1,
        phaseEndsAt: getDevPhaseEndsAt(state.nightSeconds || 60),
        phaseEndsAtOffset: undefined,
        myVoteTargetId: null,
        votedCount: 0,
        revoteCandidateIds: null,
        lastEliminatedName: null,
      }));
      return true;
    }

    return false;
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

  const aliveParticipants = state.participants.filter((participant) => participant.isAlive);
  const myRole = state.myRole ? roleCopy[state.myRole] : null;
  const isOpeningNight = state.status === "Night" && state.phaseNumber === 1;
  const fellowWerewolfIds = new Set((state.fellowWerewolves ?? []).map((w) => w.id));
  const killTargets = state.myRole === "Werewolf" && !isOpeningNight ? aliveParticipants.filter((p) => p.id !== state.me?.id && !fellowWerewolfIds.has(p.id)) : [];
  const seerTargets = state.myRole === "Seer" ? aliveParticipants.filter((p) => p.id !== state.me?.id) : [];
  const voteTargets = state.status === "Voting" ? aliveParticipants : [];
  const revoteCandidateIds = state.revoteCandidateIds ?? [];
  const revoteTargets = state.status === "Revote" ? aliveParticipants.filter((p) => revoteCandidateIds.includes(p.id)) : [];
  const currentSeerCheck = state.mySeerChecks?.find((c) => c.phaseNumber === state.phaseNumber);
  const secondsLeft = state.phaseEndsAt ? Math.max(0, Math.ceil((new Date(state.phaseEndsAt).getTime() - now) / 1000)) : 0;
  const PhaseIcon = phaseIcon[state.status] ?? AiGameIcon;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-4 sm:py-8">
        <header className="rounded-2xl border bg-gradient-to-br from-zinc-950 via-slate-900 to-red-950 p-4 text-white sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-200/80">Werewolf Room</p>
              <h1 className="mt-1 text-3xl font-black tracking-[0.18em] sm:text-5xl">{state.code}</h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <HugeiconsIcon icon={UserGroupIcon} size={14} />
              <span>{state.participants.length}/{state.playerLimit}</span>
              <Button onClick={copyLink} size="sm" variant="outline" className="h-8 border-white/20 bg-white/10 text-white hover:bg-white/20">
                <HugeiconsIcon icon={CopyLinkIcon} strokeWidth={2} className="size-3.5" />
                {copied ? "Tersalin" : "Link"}
              </Button>
            </div>
          </div>
          <p className="mt-3 text-sm text-zinc-300">{phaseCopy[state.status]}</p>
        </header>

        {!state.isJoined ? (
          <section className="mx-auto flex max-w-md flex-col gap-4 rounded-md border bg-muted/30 p-4 text-center sm:p-5">
            <p className="text-xs font-medium text-muted-foreground">Gabung room {state.code}</p>
            <h2 className="text-2xl font-bold tracking-tight">{isGuest ? "Pakai nama dulu, baru masuk desa." : "Gabung dengan akunmu."}</h2>
            {session && <p className="text-sm text-muted-foreground">Kamu masuk sebagai {session.user.name || session.user.email}.</p>}
            {isGuest && <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama display" className="h-9 bg-background text-center" />}
            <Button onClick={() => runAction(() => joinWerewolfRoom(code, name))} disabled={isPending} className="h-9">Gabung Room</Button>
          </section>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                      <HugeiconsIcon icon={PhaseIcon} strokeWidth={2} className="size-4" />
                      Fase {state.status}
                    </p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight">Hari ke-{Math.max(1, state.phaseNumber)}</h2>
                    {state.status === "Revote" && <p className="text-xs text-muted-foreground">Putaran revote ke-{state.currentVoteRound}</p>}
                  </div>
                  {myRole && (
                    <div className="rounded-xl border bg-background px-4 py-3 text-right">
                      <p className="text-[11px] text-muted-foreground">Role kamu</p>
                      <p className="text-lg font-black text-primary">{myRole.title}</p>
                    </div>
                  )}
                </div>
                  {myRole && <p className="mt-4 rounded-md bg-background p-3 text-sm text-muted-foreground">{myRole.hint}</p>}
                {state.finishedReason && <p className="mt-4 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm font-semibold text-primary">{state.finishedReason}</p>}
              </div>

              {state.status === "Lobby" && (
                <div className="space-y-3 rounded-md border bg-muted/30 p-4 sm:p-5">
                  <p className="text-sm text-muted-foreground">Tunggu sampai minimal {state.minPlayers} pemain. Role dibagi otomatis saat leader mulai game.</p>

                  <div className="rounded-md border border-border/50 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <HugeiconsIcon icon={Clock01Icon} size={14} strokeWidth={2} className="size-3.5" />
                      Durasi fase
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-md bg-background px-2 py-1.5 text-xs"><span className="text-muted-foreground">Malam </span><span className="font-semibold">{state.nightSeconds}s</span></div>
                      <div className="rounded-md bg-background px-2 py-1.5 text-xs"><span className="text-muted-foreground">Siang </span><span className="font-semibold">{state.daySeconds}s</span></div>
                      <div className="rounded-md bg-background px-2 py-1.5 text-xs"><span className="text-muted-foreground">Voting </span><span className="font-semibold">{state.votingSeconds}s</span></div>
                      <div className="rounded-md bg-background px-2 py-1.5 text-xs"><span className="text-muted-foreground">Revote </span><span className="font-semibold">{state.revoteSeconds}s</span></div>
                    </div>
                    {state.isLeader && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <label className="space-y-1 text-[11px] text-muted-foreground">Malam<Input type="number" min={15} max={300} value={nightInput} onChange={(e) => setNightInput(Number(e.target.value))} className="h-8 bg-background" /></label>
                        <label className="space-y-1 text-[11px] text-muted-foreground">Siang<Input type="number" min={30} max={600} value={dayInput} onChange={(e) => setDayInput(Number(e.target.value))} className="h-8 bg-background" /></label>
                        <label className="space-y-1 text-[11px] text-muted-foreground">Voting<Input type="number" min={15} max={300} value={votingInput} onChange={(e) => setVotingInput(Number(e.target.value))} className="h-8 bg-background" /></label>
                        <label className="space-y-1 text-[11px] text-muted-foreground">Revote<Input type="number" min={10} max={120} value={revoteInput} onChange={(e) => setRevoteInput(Number(e.target.value))} className="h-8 bg-background" /></label>
                        <div className="col-span-2 sm:col-span-4">
                          <Button variant="outline" size="sm" onClick={() => runAction(() => updateWerewolfTimers(code, { nightSeconds: nightInput, daySeconds: dayInput, votingSeconds: votingInput, revoteSeconds: revoteInput }))} disabled={isPending} className="h-8 bg-background">Simpan timer</Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {state.isLeader && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input type="number" min={4} max={16} value={playerLimitInput} onChange={(event) => setPlayerLimitInput(Number(event.target.value))} className="h-9 bg-background" />
                      <Button variant="outline" onClick={() => runAction(() => updateWerewolfPlayerLimit(code, playerLimitInput))} disabled={isPending} className="h-9 bg-background">Simpan limit</Button>
                      <Button onClick={() => {
                        if (hasDevPatches) {
                          const realPlayers = (rawState?.participants ?? []) as unknown as Array<{ id: string }>;
                          const mocks = devPatches.mockParticipants ?? [];
                          const total = realPlayers.length + mocks.length;
                          if (total < 4) return;
                          const roles = shuffleRoles(total);
                          const overrides: Record<string, { role: string }> = {};
                          for (const p of realPlayers) overrides[p.id] = { role: roles.shift()! };
                          const assignedMocks = mocks.map((m) => ({ ...m, role: roles.shift()!, isAlive: true }));
                          const currentMeId = devPatches.meId ?? rawState?.me?.id ?? null;
                          const currentRole = currentMeId
                            ? overrides[currentMeId]?.role ?? assignedMocks.find((m) => m.id === currentMeId)?.role ?? null
                            : devPatches.myRole ?? null;
                          setDevPatches((prev) => materializeDevPatches({
                            ...prev,
                            status: "Night",
                            phaseNumber: 1,
                            phaseEndsAtOffset: 45,
                            isAlive: true,
                            isJoined: true,
                            myRole: currentRole,
                            myKillTargetId: null,
                            mySeerCheckTargetId: null,
                            myVoteTargetId: null,
                            nightActionSubmitted: false,
                            lastEliminatedName: null,
                            finishedReason: null,
                            participantOverrides: { ...prev.participantOverrides, ...overrides },
                            mockParticipants: assignedMocks,
                          }));
                          return;
                        }
                        runAction(() => startWerewolfGame(code));
                      }} disabled={isPending || state.participants.length < state.minPlayers} className="h-9">Mulai Game</Button>
                    </div>
                  )}
                  {state.participants.length < state.minPlayers && <p className="text-xs text-muted-foreground">Butuh {state.minPlayers - state.participants.length} pemain lagi untuk mulai.</p>}
                </div>
              )}

              {state.status === "Night" && (
                <div className="space-y-3 rounded-md border bg-gradient-to-br from-slate-950 to-indigo-950/40 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.2em] text-indigo-200">
                      <HugeiconsIcon icon={Moon02Icon} strokeWidth={2} className="size-4" />
                      Malam
                    </p>
                    {secondsLeft > 0 && <div className="rounded-md border border-indigo-300/30 bg-indigo-950/40 px-3 py-1.5 text-lg font-bold tabular-nums text-indigo-100">{formatTime(secondsLeft)}</div>}
                  </div>
                  {isOpeningNight && (
                    <p className="rounded-md border border-indigo-300/30 bg-indigo-950/30 p-3 text-sm text-indigo-100">
                      Malam 1 adalah pembukaan lunak: desa masih utuh, werewolf hanya saling mengenali, dan kill dimulai pada Malam 2. Seer tetap bisa memeriksa satu pemain.
                    </p>
                  )}

                  {!state.me?.isAlive ? (
                    <p className="rounded-md bg-background/60 p-3 text-sm text-muted-foreground">Kamu sudah gugur. Tunggu sampai pagi.</p>
                  ) : state.myRole === "Werewolf" ? (
                    <div className="space-y-3">
                      {state.fellowWerewolves && state.fellowWerewolves.length > 0 && (
                        <p className="text-xs text-muted-foreground">Werewolf lain: <span className="font-semibold text-foreground">{state.fellowWerewolves.map((w) => w.name).join(", ")}</span></p>
                      )}
                      {isOpeningNight ? (
                        <p className="rounded-md bg-background/60 p-3 text-sm text-muted-foreground">Belum ada kill pada Malam 1. Gunakan fase ini untuk mengenali rekan werewolf dan menunggu pagi.</p>
                      ) : (
                        <>
                          <p className="text-sm font-semibold">Pilih target kill:</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {killTargets.map((p) => (
                              <button key={p.id} type="button" onClick={() => { if (devClick({ myKillTargetId: p.id })) return; runAction(() => submitWerewolfKillTarget(code, p.id)); }} disabled={isPending}
                                className={`rounded-md border p-3 text-left transition-colors disabled:opacity-50 ${state.myKillTargetId === p.id ? "border-red-500 bg-red-500/10 text-red-600" : "bg-background hover:border-red-400/50"}`}>
                                <span className="block text-sm font-bold">{p.name}</span>
                              </button>
                            ))}
                          </div>
                          {state.myKillTargetId && <p className="text-xs text-muted-foreground">Kamu memilih: <span className="font-semibold text-foreground">{aliveParticipants.find((p) => p.id === state.myKillTargetId)?.name}</span></p>}
                        </>
                      )}
                    </div>
                  ) : state.myRole === "Seer" ? (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Periksa satu pemain:</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {seerTargets.map((p) => (
                          <button key={p.id} type="button" onClick={() => { if (currentSeerCheck || devSeerCheck(p)) return; runAction(() => submitSeerCheck(code, p.id)); }} disabled={isPending || Boolean(currentSeerCheck)}
                            className={`rounded-md border p-3 text-left transition-colors disabled:opacity-50 ${state.mySeerCheckTargetId === p.id ? "border-sky-500 bg-sky-500/10 text-sky-600" : "bg-background hover:border-sky-400/50"}`}>
                            <span className="block text-sm font-bold">{p.name}</span>
                          </button>
                        ))}
                      </div>
                      {currentSeerCheck && <p className="text-xs text-muted-foreground">Kamu memeriksa: <span className="font-semibold text-foreground">{currentSeerCheck.targetName} ({roleLabel(currentSeerCheck.inspectedRole)})</span>. Pemeriksaan malam ini sudah digunakan.</p>}
                      {state.mySeerChecks && state.mySeerChecks.length > 0 && (
                        <div className="space-y-1 rounded-md bg-background/60 p-3">
                          <p className="text-xs font-semibold text-muted-foreground">Riwayat pemeriksaan:</p>
                          {state.mySeerChecks.map((c) => (
                            <p key={c.phaseNumber} className="text-xs">Malam {c.phaseNumber}: {c.targetName} adalah <span className="font-semibold">{roleLabel(c.inspectedRole)}</span></p>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="rounded-md bg-background/60 p-3 text-sm text-muted-foreground">Malam hari, tunggu sampai pagi.</p>
                  )}

                  <p className="text-xs text-muted-foreground">{state.nightActionSubmitted ? "Semua aksi selesai." : "Menunggu aksi malam..."}</p>
                </div>
              )}

              {state.status === "Day" && (
                <div className="space-y-3 rounded-md border bg-gradient-to-br from-amber-50 to-orange-50/40 p-4 text-foreground sm:p-5 dark:from-amber-950/30 dark:to-orange-950/20">
                  <div className="flex items-center justify-between gap-3">
                    <p className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">
                      <HugeiconsIcon icon={Sun02Icon} strokeWidth={2} className="size-4" />
                      Siang
                    </p>
                    {secondsLeft > 0 && <div className="rounded-md border border-amber-300/40 bg-amber-50 px-3 py-1.5 text-lg font-bold tabular-nums text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">{formatTime(secondsLeft)}</div>}
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-background/70 p-3 text-sm">
                    <HugeiconsIcon icon={MegaphoneIcon} strokeWidth={2} className="size-4 text-amber-600 dark:text-amber-300" />
                    {state.lastEliminatedName ? <span><span className="font-bold">{state.lastEliminatedName}</span> ditemukan tewas malam ini. Diskusi dan tentukan tersangka.</span> : <span>Tidak ada yang terbunuh malam ini. Desa masih utuh, lanjut diskusi.</span>}
                  </div>
                </div>
              )}

              {state.status === "Voting" && (
                <div className="space-y-3 rounded-md border bg-muted/30 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.2em] text-primary">
                      <HugeiconsIcon icon={FireIcon} strokeWidth={2} className="size-4" />
                      Voting
                    </p>
                    {secondsLeft > 0 && <div className="rounded-md border bg-background px-3 py-1.5 text-lg font-bold tabular-nums text-primary">{formatTime(secondsLeft)}</div>}
                  </div>
                  <p className="text-xs text-muted-foreground">Sudah vote: <span className="font-bold text-foreground">{state.votedCount}/{state.totalAliveVoters}</span></p>
                  {state.me?.isAlive ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {voteTargets.map((p) => (
                        <button key={p.id} type="button" onClick={() => { if (devClick({ myVoteTargetId: p.id })) return; runAction(() => submitWerewolfVote(code, p.id)); }} disabled={isPending}
                            className={`rounded-md border p-3 text-left transition-colors disabled:opacity-50 ${state.myVoteTargetId === p.id ? "border-primary bg-primary/10 text-primary" : "bg-background hover:border-primary/40"}`}>
                          <span className="block text-sm font-bold">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.voteCount} vote masuk</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md bg-background p-3 text-sm text-muted-foreground">Pemain gugur tidak bisa vote.</p>
                  )}
                </div>
              )}

              {state.status === "Revote" && (
                <div className="space-y-3 rounded-md border border-amber-300/50 bg-amber-50/40 p-4 sm:p-5 dark:bg-amber-950/20">
                  <div className="flex items-center justify-between gap-3">
                    <p className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">
                      <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4" />
                      Revote
                    </p>
                    {secondsLeft > 0 && <div className="rounded-md border border-amber-300/40 bg-background px-3 py-1.5 text-lg font-bold tabular-nums text-amber-700 dark:text-amber-200">{formatTime(secondsLeft)}</div>}
                  </div>
                  <p className="text-sm font-semibold">Revote! Pilih di antara pemain yang seri.</p>
                  <p className="text-xs text-muted-foreground">Sudah vote: <span className="font-bold text-foreground">{state.votedCount}/{state.totalAliveVoters}</span></p>
                  {state.me?.isAlive ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {revoteTargets.map((p) => (
                        <button key={p.id} type="button" onClick={() => { if (devClick({ myVoteTargetId: p.id })) return; runAction(() => submitWerewolfVote(code, p.id)); }} disabled={isPending}
                          className={`rounded-md border p-3 text-left transition-colors disabled:opacity-50 ${state.myVoteTargetId === p.id ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-background hover:border-amber-400/50"}`}>
                          <span className="block text-sm font-bold">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.voteCount} vote masuk</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md bg-background p-3 text-sm text-muted-foreground">Pemain gugur tidak bisa vote.</p>
                  )}
                </div>
              )}

              {state.isLeader && state.status !== "Lobby" && state.status !== "Finished" && (
                <div className="flex flex-wrap justify-end gap-2">
                  {state.status === "Night" && <Button onClick={() => { if (devResolveCurrentPhase()) return; runAction(() => advanceWerewolfPhase(code)); }} disabled={isPending}>Lanjut ke Siang</Button>}
                  {state.status === "Day" && <Button onClick={() => { if (devResolveCurrentPhase()) return; runAction(() => advanceWerewolfPhase(code)); }} disabled={isPending}>Mulai Voting</Button>}
                  {(state.status === "Voting" || state.status === "Revote") && <Button onClick={() => { if (devResolveCurrentPhase()) return; runAction(() => resolveWerewolfVoting(code)); }} disabled={isPending} variant="outline" className="bg-background">{state.status === "Revote" ? "Resolve Revote" : "Resolve Voting"}</Button>}
                </div>
              )}
            </section>

            <aside className="space-y-3 rounded-md border bg-muted/30 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold"><HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-4" />Pemain</h2>
                <span className="text-xs text-muted-foreground">{state.aliveCount} hidup</span>
              </div>
              <div className="space-y-2">
                {state.participants.map((participant) => (
                  <div key={participant.id} className={`rounded-md border bg-background p-3 ${participant.isAlive ? "" : "opacity-60"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{participant.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${participant.isAlive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{participant.isAlive ? "Hidup" : "Gugur"}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>{participant.isLeader ? "Leader" : "Pemain"}</span>
                      {participant.role && <span className="font-semibold text-foreground">· {roleLabel(participant.role)}</span>}
                      {(state.status === "Voting" || state.status === "Revote") && participant.isAlive && (
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${participant.hasVoted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{participant.hasVoted ? "Sudah vote" : "Belum vote"}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {state.status === "Finished" && state.werewolfCount !== null && (
                <p className="text-xs text-muted-foreground">Total werewolf: <span className="font-semibold text-foreground">{state.werewolfCount}</span></p>
              )}
            </aside>
          </div>
        )}

        {message && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</p>}

        <div className="flex justify-end">
          <Button asChild variant="ghost" size="sm"><Link href="/werewolf-multiplayer">Room Baru</Link></Button>
        </div>
      </div>
      <WerewolfDevTools
        rawState={rawState as unknown as Record<string, unknown>}
        patches={devPatches}
        onPatch={setDevPatches}
      />
    </main>
  );
}
