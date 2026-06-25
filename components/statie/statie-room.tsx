"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  BubbleChatSparkIcon,
  Clock01Icon,
  CogIcon,
  CopyLinkIcon,
  Delete02Icon,
  Mic01Icon,
  MicOffIcon,
  PencilEdit01Icon,
  SaveIcon,
  StopIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
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
import { useStatieRealtime } from "@/hooks/use-statie-realtime";

import {
  finishStatieRound,
  getStatieRoomState,
  joinStatieRoom,
  kickStatieParticipant,
  startStatieDebate,
  startStatieRound,
  submitStatieTranscript,
  submitStatieVote,
  updateStatiePlayerLimit,
  updateStatieRoomTimers,
  updateStatieRoomTopic,
} from "@/app/actions/statie";

type RoomState = Awaited<ReturnType<typeof getStatieRoomState>>;
type ActiveRound = NonNullable<NonNullable<RoomState>["round"]>;
type VoteChoice = "Agree" | "Disagree";

type StatieAiScore = {
  participants: {
    participantId: string;
    score: number;
    reason: string;
    criteria?: Record<string, number>;
  }[];
  winnerParticipantId: string | null;
  summary: string;
};

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const rest = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function pickSupportedMimeType() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  return "bin";
}

function getAiScore(value: unknown): StatieAiScore | null {
  if (!value || typeof value !== "object") return null;
  const score = value as StatieAiScore;
  return Array.isArray(score.participants) && typeof score.summary === "string" ? score : null;
}

export function StatieRoom({ code }: { code: string }) {
  const [state, setState] = useState<RoomState>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [nextTopic, setNextTopic] = useState("");
  const [votingSecondsInput, setVotingSecondsInput] = useState(30);
  const [debateMinutesInput, setDebateMinutesInput] = useState(15);
  const [playerLimitInput, setPlayerLimitInput] = useState(10);
  const [customStatement, setCustomStatement] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [recorderMessage, setRecorderMessage] = useState("");
  const [isMicReady, setIsMicReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcriptRoundIdRef = useRef<string | null>(null);
  const recordedRoundIdRef = useRef<string | null>(null);
  const votingExpiredRoundIdRef = useRef<string | null>(null);
  const autoFinishRoundIdRef = useRef<string | null>(null);
  const finishAfterTranscribeRef = useRef(false);
  const { data: session, isPending: sessionPending } = useSession();
  const isGuest = !sessionPending && !session;

  function applyRoomState(nextState: RoomState) {
    setState(nextState);
    if (nextState) setPlayerLimitInput(nextState.playerLimit);
    if (nextState) setVotingSecondsInput(nextState.votingSeconds);
    if (nextState) setDebateMinutesInput(Math.round(nextState.debateSeconds / 60));
    setNextTopic((current) => current || nextState?.topic || "");

    const roundId = nextState?.round?.id ?? null;
    if (transcriptRoundIdRef.current !== roundId) {
      transcriptRoundIdRef.current = roundId;
      recordedRoundIdRef.current = nextState?.round?.myTranscript ? roundId : null;
      votingExpiredRoundIdRef.current = null;
      autoFinishRoundIdRef.current = null;
      setTranscriptText(nextState?.round?.myTranscript ?? "");
      setRecorderMessage("");
    }
  }

  async function refresh() {
    const nextState = await getStatieRoomState(code);
    applyRoomState(nextState);
  }

  useEffect(() => {
    let active = true;

    const loadState = async () => {
      const nextState = await getStatieRoomState(code);
      if (active) applyRoomState(nextState);
    };

    void loadState();
    return () => {
      active = false;
    };
  }, [code]);

  useEffect(() => {
    if (state?.round?.status !== "Voting" && state?.round?.status !== "Debate") return;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state?.round?.status]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const votes = state?.round?.votes ?? [];
  const voteByParticipantId = new Map(votes.map((vote) => [vote.participantId, vote]));
  const agreeVotes = votes.filter((vote) => vote.choice === "Agree");
  const disagreeVotes = votes.filter((vote) => vote.choice === "Disagree");
  const activeRoundId = state?.round?.id ?? null;
  const activeRoundStatus = state?.round?.status ?? null;
  const isLeader = Boolean(state?.isLeader);
  const votingSecondsLeft = state?.round?.votingEndsAt ? Math.ceil((new Date(state.round.votingEndsAt).getTime() - now) / 1000) : 0;
  const debateSecondsLeft = state?.round?.debateEndsAt ? Math.ceil((new Date(state.round.debateEndsAt).getTime() - now) / 1000) : 0;
  const shareUrl = useMemo(() => (typeof window === "undefined" ? "" : `${window.location.origin}/statie/${code}`), [code]);
  const resultScore = getAiScore(state?.lastResult?.aiScore);
  const realtime = useStatieRealtime(code, async () => {
    await refresh();
  }, (text) => {
    setCustomStatement(text);
  });

  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishDraftRef = useRef(realtime.publishDraft);
  publishDraftRef.current = realtime.publishDraft;

  useEffect(() => {
    if (!state?.isLeader || state.round) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      publishDraftRef.current(customStatement);
    }, 200);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [customStatement, state?.isLeader, state?.round]);
  const realtimeLabel = realtime.status === "connected"
    ? "Realtime on"
    : realtime.status === "disabled"
      ? "Realtime off"
      : realtime.status === "error"
        ? "Realtime error"
        : "Connecting";

  function runAction(action: () => Promise<{ success: boolean; message?: string }>, realtimeAction = "action") {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      if (!result.success) setMessage(result.message ?? "Aksi gagal.");
      await refresh();
      if (result.success) realtime.publish(realtimeAction);
    });
  }

  function joinRoom() {
    runAction(() => joinStatieRoom(code, name), "join");
  }

  function vote(choice: VoteChoice) {
    runAction(() => submitStatieVote(code, choice), "vote");
  }

  function finishRoundAction() {
    runAction(() => finishStatieRound(code), "finish-round");
  }

  function saveTranscript(text = transcriptText) {
    const roundId = state?.round?.id;
    if (!roundId) return;
    runAction(() => submitStatieTranscript(code, roundId, text), "transcript");
  }

  function changeTopic() {
    runAction(() => updateStatieRoomTopic(code, nextTopic), "topic");
  }

  function changePlayerLimit() {
    runAction(() => updateStatiePlayerLimit(code, playerLimitInput), "player-limit");
  }

  function changeTimers() {
    runAction(() => updateStatieRoomTimers(code, {
      votingSeconds: votingSecondsInput,
      debateSeconds: debateMinutesInput * 60,
    }), "timers");
  }

  function kickParticipant(participantId: string) {
    runAction(() => kickStatieParticipant(code, participantId), "kick");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function uploadRecording(blob: Blob, mimeType: string, round: ActiveRound) {
    setIsTranscribing(true);
    setRecorderMessage("Mengirim audio ke Whisper...");
    try {
      const formData = new FormData();
      formData.set("audio", new File([blob], `statie-${round.id}.${extensionForMimeType(mimeType)}`, { type: mimeType || blob.type }));
      formData.set("code", code);
      formData.set("roundId", round.id);
      formData.set("language", "id");
      formData.set("prompt", round.statement);

      const response = await fetch("/api/statie/transcribe", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Transkripsi gagal.");

      const text = String(result.text || "").trim();
      setTranscriptText(text);
      if (text) {
        const saved = await submitStatieTranscript(code, round.id, text);
        if (!saved.success) throw new Error(saved.message);
        realtime.publish("transcript");
      }
      setRecorderMessage("Transcript tersimpan untuk AI scoring.");
      await refresh();
    } catch (error) {
      setRecorderMessage(error instanceof Error ? error.message : "Transkripsi gagal.");
    } finally {
      setIsTranscribing(false);
      if (finishAfterTranscribeRef.current) {
        finishAfterTranscribeRef.current = false;
        finishRoundAction();
      }
    }
  }

  async function prepareMic() {
    setRecorderMessage("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setRecorderMessage("Browser ini belum mendukung rekaman audio. Isi transcript manual di bawah.");
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsMicReady(true);
      const round = state?.round;
      if (round?.status === "Debate" && debateSecondsLeft > 0 && recordedRoundIdRef.current !== round.id) {
        startRecordingForRound(round, stream);
      } else {
        setRecorderMessage("Mic siap. Rekaman akan otomatis mengikuti timer debat.");
      }
      return stream;
    } catch (error) {
      setIsMicReady(false);
      setRecorderMessage(error instanceof Error ? error.message : "Tidak bisa mengakses mikrofon.");
      return null;
    }
  }

  function startRecordingForRound(round: ActiveRound, stream: MediaStream) {
    if (isRecording || recorderRef.current?.state === "recording") return;

    try {
      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setIsRecording(false);
        recordedRoundIdRef.current = round.id;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size > 0) {
          void uploadRecording(blob, recorder.mimeType || mimeType || blob.type, round);
          return;
        }
        if (finishAfterTranscribeRef.current) {
          finishAfterTranscribeRef.current = false;
          finishRoundAction();
        }
      };
      recorder.start();
      setIsRecording(true);
      setRecorderMessage("Rekaman otomatis berjalan mengikuti timer debat.");
    } catch (error) {
      setRecorderMessage(error instanceof Error ? error.message : "Tidak bisa mengakses mikrofon.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  const finishRoundFromTimer = useEffectEvent(() => {
    finishRoundAction();
  });

  const stopRecordingFromTimer = useEffectEvent((showScoringMessage: boolean) => {
    if (showScoringMessage) setRecorderMessage("Timer habis. Menghentikan rekaman, transcribe, lalu scoring...");
    stopRecording();
  });

  const refreshFromVotingTimer = useEffectEvent(async () => {
    await refresh();
  });

  function finishRound() {
    if (isRecording) {
      finishAfterTranscribeRef.current = true;
      setRecorderMessage("Menghentikan rekaman, transcribe, lalu scoring...");
      stopRecording();
      return;
    }

    if (isTranscribing) {
      finishAfterTranscribeRef.current = true;
      setRecorderMessage("Menunggu transkripsi selesai sebelum scoring...");
      return;
    }

    finishRoundAction();
  }

  function renderMicControl() {
    const isScoring = isPending && activeRoundStatus === "Debate";
    const isBusy = isTranscribing || isScoring;
    const micClass = !isMicReady
      ? "size-12 rounded-full shadow-md"
      : isRecording
        ? "size-12 rounded-full border-primary/30 bg-primary/10 text-primary shadow-md"
        : isBusy
          ? "size-12 rounded-full border-amber-500/30 bg-amber-500/10 text-amber-600 shadow-md dark:text-amber-400"
          : "size-12 rounded-full shadow-md";
    const micLabel = isScoring
      ? "AI scoring"
      : isTranscribing
        ? "Transcribing"
        : isRecording
          ? "Recording"
          : isMicReady
            ? "Mic ready"
            : "Activate mic";

    return (
      <div className="flex flex-col items-center gap-2">
        <Button onClick={!isMicReady ? prepareMic : undefined} disabled={isMicReady || isTranscribing} size="icon" className={`relative ${micClass}`} aria-label={micLabel}>
          <HugeiconsIcon icon={isMicReady ? Mic01Icon : MicOffIcon} strokeWidth={2} className="size-5" />
          {isBusy && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-amber-500 ring-2 ring-background animate-pulse" />}
          {isRecording && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-primary ring-2 ring-background animate-pulse" />}
        </Button>
      </div>
    );
  }

  useEffect(() => {
    if (activeRoundStatus !== "Voting" || !activeRoundId || votingSecondsLeft > 0) return;
    if (votingExpiredRoundIdRef.current === activeRoundId) return;

    votingExpiredRoundIdRef.current = activeRoundId;
    const refreshTimeout = window.setTimeout(() => {
      void refreshFromVotingTimer();
    }, 0);

    return () => window.clearTimeout(refreshTimeout);
  }, [activeRoundId, activeRoundStatus, votingSecondsLeft]);

  useEffect(() => {
    const round = state?.round;
    if (round?.status !== "Debate" || !streamRef.current || isRecording || isTranscribing) return;
    if (debateSecondsLeft <= 0 || recordedRoundIdRef.current === round.id) return;
    startRecordingForRound(round, streamRef.current);
    // Auto-start is intentionally keyed to the round transition, not every recorder helper identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.round?.id, state?.round?.status, isRecording, isTranscribing, debateSecondsLeft]);

  useEffect(() => {
    if (activeRoundStatus !== "Debate" || !activeRoundId || debateSecondsLeft > 0) return;

    let finishTimeout: number | undefined;
    let stopTimeout: number | undefined;
    if (isLeader && autoFinishRoundIdRef.current !== activeRoundId) {
      autoFinishRoundIdRef.current = activeRoundId;
      finishAfterTranscribeRef.current = isRecording || isTranscribing;
      if (!isRecording && !isTranscribing) finishTimeout = window.setTimeout(() => finishRoundFromTimer(), 0);
    }

    if (isRecording) {
      stopTimeout = window.setTimeout(() => stopRecordingFromTimer(isLeader), 0);
    }

    return () => {
      if (finishTimeout) window.clearTimeout(finishTimeout);
      if (stopTimeout) window.clearTimeout(stopTimeout);
    };
  }, [activeRoundId, activeRoundStatus, isLeader, isRecording, isTranscribing, debateSecondsLeft]);

  if (state === null) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Memuat room...</p>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
        <div className="max-w-sm rounded-2xl border bg-card p-5 text-center shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">Room tidak ditemukan</h1>
          <Button asChild className="mt-5">
            <Link href="/statie">Kembali ke Statie</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-4 sm:py-8">
        <div className="mb-2 space-y-3 sm:mb-4">
          <div className="py-3 sm:py-4">
            <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon-xs" className="shrink-0">
                  <Link href="/statie" aria-label="Kembali ke Statie">
                    <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />
                  </Link>
                </Button>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
                  Statie Room
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <HugeiconsIcon icon={UserGroupIcon} size={14} className="text-muted-foreground" />
                <span className="font-medium text-muted-foreground/70">{state.participants.length}/{state.playerLimit}</span>
                <span className="hidden sm:inline">orang</span>
                <span className="mx-0.5 text-muted-foreground/40">|</span>
                <HugeiconsIcon icon={Clock01Icon} size={14} className="text-muted-foreground" />
                <span className="font-medium text-muted-foreground/70">{state.votingSeconds}s/{Math.round(state.debateSeconds / 60)}m</span>
                <span className="mx-0.5 text-muted-foreground/40">|</span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${realtime.status === "connected" ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400" : realtime.status === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border bg-background text-muted-foreground"}`}>
                  <span className={`size-1.5 rounded-full ${realtime.status === "connected" ? "bg-green-500" : realtime.status === "error" ? "bg-destructive" : "bg-muted-foreground/50"}`} />
                  {realtimeLabel}
                </span>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="xs" className="h-6 gap-1 rounded-full px-2 text-[11px]">
                      <HugeiconsIcon icon={CogIcon} strokeWidth={2} className="size-3" />
                      Setting
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Setting Room</DialogTitle>
                      <DialogDescription>
                        Kelola topik, peserta, dan link room Statie ini.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
                            <HugeiconsIcon icon={BubbleChatSparkIcon} strokeWidth={2} className="size-4" />
                            Topik
                          </h2>
                          <span className="text-xs text-muted-foreground">{state.status}</span>
                        </div>

                        <div className="rounded-md border bg-muted/30 p-3">
                          <p className="text-sm font-medium leading-5">{state.topic}</p>
                        </div>

                        {state.isLeader && !state.round ? (
                          <div className="flex gap-2">
                            <Input
                              value={nextTopic}
                              onChange={(event) => setNextTopic(event.target.value)}
                              placeholder="Topik baru"
                              className="h-9 min-w-0 flex-1"
                            />
                            <Button
                              onClick={changeTopic}
                              disabled={isPending || nextTopic.trim() === state.topic}
                              variant="outline"
                              className="h-9"
                            >
                              Simpan
                            </Button>
                          </div>
                        ) : (
                          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                            Topik hanya bisa diganti leader sebelum ronde dimulai.
                          </p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
                            <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-4" />
                            Timer
                          </h2>
                          <span className="text-xs text-muted-foreground">Vote {state.votingSeconds}s · Debat {Math.round(state.debateSeconds / 60)}m</span>
                        </div>

                        {state.isLeader && !state.round ? (
                          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                            <label className="space-y-1.5 text-xs text-muted-foreground">
                              Voting (detik)
                              <Input
                                type="number"
                                min={10}
                                max={120}
                                value={votingSecondsInput}
                                onChange={(event) => setVotingSecondsInput(Number(event.target.value))}
                                className="h-9 bg-background"
                              />
                            </label>
                            <label className="space-y-1.5 text-xs text-muted-foreground">
                              Debat (menit)
                              <Input
                                type="number"
                                min={1}
                                max={15}
                                value={debateMinutesInput}
                                onChange={(event) => setDebateMinutesInput(Number(event.target.value))}
                                className="h-9 bg-background"
                              />
                            </label>
                            <Button
                              onClick={changeTimers}
                              disabled={isPending || (votingSecondsInput === state.votingSeconds && debateMinutesInput * 60 === state.debateSeconds)}
                              variant="outline"
                              className="h-9 self-end"
                            >
                              Simpan timer
                            </Button>
                          </div>
                        ) : (
                          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                            Timer hanya bisa diganti leader sebelum ronde dimulai.
                          </p>
                        )}
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

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
                            <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-4" />
                            Pemain
                          </h2>
                          <span className="text-xs text-muted-foreground">{state.participants.length}/{state.playerLimit} pemain</span>
                        </div>

                        {state.isLeader ? (
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min={2}
                              max={30}
                              value={playerLimitInput}
                              onChange={(event) => setPlayerLimitInput(Number(event.target.value))}
                              className="h-9 min-w-0 flex-1"
                            />
                            <Button
                              onClick={changePlayerLimit}
                              disabled={isPending || playerLimitInput === state.playerLimit}
                              variant="outline"
                              className="h-9"
                            >
                              Simpan limit
                            </Button>
                          </div>
                        ) : null}

                        <div className="space-y-1.5">
                          {state.participants.map((participant) => (
                            <div key={participant.id} className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">{participant.name}</p>
                                <p className="text-[10px] text-muted-foreground">{participant.isLeader ? "Leader" : "Pemain"}</p>
                              </div>
                              {state.isLeader && !participant.isLeader ? (
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => kickParticipant(participant.id)}
                                  disabled={isPending}
                                  aria-label={`Kick ${participant.name}`}
                                >
                                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
                                </Button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                {state.round ? (
                  <div>
                    <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-3xl">
                      {state.round.statement}
                    </h1>
                    <p className="mt-1 truncate text-xs text-muted-foreground/70">
                      {state.topic}
                    </p>
                  </div>
                ) : state.isLeader || customStatement.trim() ? (
                  <div className="flex items-center gap-2">
                    <textarea
                      value={customStatement}
                      onChange={(event) => setCustomStatement(event.target.value)}
                      placeholder="Tulis argumen untuk Debat..."
                      readOnly={!state.isLeader}
                      className="mx-2 min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-2xl placeholder:text-muted-foreground focus-visible:ring-0 sm:text-3xl md:text-4xl dark:bg-transparent [field-sizing:content] read-only:cursor-default"
                      maxLength={180}
                      rows={1}
                    />
                    {state.isLeader && (
                      <Button
                        onClick={() => { runAction(() => startStatieRound(code, customStatement), "start-round"); setCustomStatement(""); }}
                        disabled={isPending}
                        size="sm"
                        className="h-8 shrink-0"
                      >
                      <span className="text-base">{customStatement.trim() ? <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} className="size-4" /> : "🎲"}</span>
                      {customStatement.trim() ? "Mulai" : "Random"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <h1 className="text-2xl font-bold tracking-[0.16em] transition-all sm:text-3xl md:text-4xl">
                    {state.code}
                  </h1>
                )}
              </div>
            </div>
          </div>
        </div>

        <section className="space-y-3">
          {!state.isJoined ? (
            <div className="mx-auto flex max-w-md flex-col gap-4 rounded-md border bg-muted/30 p-4 text-center sm:p-5">
              <p className="text-xs font-medium text-muted-foreground">Gabung room {state.code}</p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {isGuest ? "Pilih nama sebelum ikut kubu." : "Gabung dengan akunmu."}
              </h2>
              {session && <p className="text-sm text-muted-foreground">Kamu masuk sebagai {session.user.name || session.user.email}.</p>}
              {isGuest && <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama display" className="h-9 bg-background text-center" />}
              <Button onClick={joinRoom} disabled={isPending} className="h-9">
                Gabung Room
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-4">
                {!state.round && (
                  <div className="rounded-md border bg-muted/30 p-4 sm:p-5">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                            <HugeiconsIcon icon={UserGroupIcon} size={14} strokeWidth={2} />
                            Lobby pemain
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {state.isLeader ? "Atur pemain dan mulai ronde saat semua siap." : "Tunggu leader memulai ronde debat."}
                          </p>
                        </div>
                        <div className="rounded-md border bg-background px-3 py-2 text-right">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Joined</p>
                          <p className="text-xl font-bold tabular-nums">{state.participants.length}/{state.playerLimit}</p>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {state.participants.map((participant, index) => (
                          <div key={participant.id} className="flex items-center gap-3 rounded-md border bg-background p-3">
                            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                              {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{participant.name}</p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {participant.isLeader ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Leader</span> : null}
                                {state.me?.id === participant.id ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Kamu</span> : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {state.round?.status === "Voting" && (
                  <div className="space-y-4 rounded-md border bg-muted/30 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Voting time</p>
                      <div className="flex items-center gap-3">
                        <div className="rounded-md border bg-background px-3 py-2 text-xl font-bold tabular-nums text-primary">
                          {formatTime(votingSecondsLeft)}
                        </div>
                        {state.isLeader && (
                          <Button onClick={() => runAction(() => startStatieDebate(code), "start-debate")} disabled={isPending} size="sm" className="h-9">
                            Mulai debat
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-6">
                      <button
                        onClick={() => vote("Agree")}
                        disabled={isPending}
                        className={`flex size-24 flex-col items-center justify-center gap-1.5 rounded-full border-2 transition-all disabled:opacity-50 ${state.round.myVote === "Agree" ? "border-green-500 bg-green-100 text-green-600 shadow-md dark:bg-green-950 dark:text-green-400" : "border-green-300 bg-green-50/50 text-green-500 hover:bg-green-100 dark:border-green-700 dark:bg-green-950/30 dark:text-green-400"}`}
                      >
                        <HugeiconsIcon icon={ThumbsUpIcon} size={32} strokeWidth={2} />
                        <span className="text-xs font-bold">Setuju</span>
                      </button>
                      <button
                        onClick={() => vote("Disagree")}
                        disabled={isPending}
                        className={`flex size-24 flex-col items-center justify-center gap-1.5 rounded-full border-2 transition-all disabled:opacity-50 ${state.round.myVote === "Disagree" ? "border-red-500 bg-red-100 text-red-600 shadow-md dark:bg-red-950 dark:text-red-400" : "border-red-300 bg-red-50/50 text-red-500 hover:bg-red-100 dark:border-red-700 dark:bg-red-950/30 dark:text-red-400"}`}
                      >
                        <HugeiconsIcon icon={ThumbsDownIcon} size={32} strokeWidth={2} />
                        <span className="text-xs font-bold">Ga Setuju</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {state.participants.map((participant) => {
                        const hasVoted = voteByParticipantId.has(participant.id);
                        return (
                          <div key={participant.id} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{participant.name}</p>
                              {participant.isLeader ? <p className="text-[10px] text-muted-foreground">Leader</p> : null}
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${hasVoted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                              {hasVoted ? "Sudah vote" : "Belum vote"}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex flex-col items-center gap-3">
                        {renderMicControl()}

                        <textarea
                          value={transcriptText}
                          onChange={(event) => setTranscriptText(event.target.value)}
                          placeholder="Tulis argumenmu, atau gunakan mic untuk transcribe otomatis."
                          className="w-full resize-none border-0 bg-transparent p-0 text-center text-xl outline-none placeholder:text-muted-foreground focus-visible:ring-0 [field-sizing:content] dark:bg-transparent"
                        />
                      </div>

                      <div className="mt-3 flex justify-end">
                        <Button onClick={() => saveTranscript()} disabled={isPending || isTranscribing || !transcriptText.trim()} variant="outline" size="icon" className="size-9 rounded-full bg-background">
                          <HugeiconsIcon icon={SaveIcon} strokeWidth={2} className="size-4" />
                        </Button>
                      </div>

                      {recorderMessage && (
                        <p className={`text-center text-xs ${recorderMessage.includes("gagal") || recorderMessage.includes("Tidak") ? "text-destructive" : "text-primary"}`}>{recorderMessage}</p>
                      )}
                    </div>
                  </div>
                )}

                {state.round && state.round.status !== "Voting" && (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-3">
                    <div className="relative overflow-hidden rounded-2xl border bg-card p-3 text-left shadow-sm sm:p-4">
                      <div className="pointer-events-none absolute -left-10 -top-12 size-28 rounded-full bg-green-500/10 blur-2xl" />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Setuju</p>
                          <p className="mt-1 text-4xl font-black leading-none tabular-nums text-green-600 dark:text-green-400">{agreeVotes.length}</p>
                        </div>
                        <div className="grid size-8 place-items-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                          <HugeiconsIcon icon={ThumbsUpIcon} strokeWidth={2} className="size-4" />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {agreeVotes.length > 0
                          ? agreeVotes.map((vote) => <span key={vote.participantId} className="rounded-md border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm">{vote.participantName}</span>)
                          : <span className="text-xs text-muted-foreground">Belum ada pemain</span>}
                      </div>
                    </div>
                    {state.round.status === "Debate" && (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="rounded-full border border-border bg-background px-3 py-2 text-sm font-black tabular-nums text-foreground shadow-sm sm:text-base">
                          {formatTime(debateSecondsLeft)}
                        </div>
                        {state.isLeader && (
                          <Button onClick={finishRound} disabled={isPending} variant="outline" size="sm" className="h-auto flex-col gap-0.5 rounded-full bg-background px-2 py-1" aria-label="Selesai & scoring">
                            <HugeiconsIcon icon={StopIcon} strokeWidth={2} className="size-4" />
                            <span className="text-[10px] font-semibold">Stop</span>
                          </Button>
                        )}
                      </div>
                    )}
                    <div className="relative overflow-hidden rounded-2xl border bg-card p-3 text-right shadow-sm sm:p-4">
                      <div className="pointer-events-none absolute -right-10 -top-12 size-28 rounded-full bg-red-500/10 blur-2xl" />
                      <div className="flex items-start justify-between gap-2">
                        <div className="grid size-8 place-items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                          <HugeiconsIcon icon={ThumbsDownIcon} strokeWidth={2} className="size-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Tidak Setuju</p>
                          <p className="mt-1 text-4xl font-black leading-none tabular-nums text-red-600 dark:text-red-400">{disagreeVotes.length}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap justify-end gap-1.5">
                        {disagreeVotes.length > 0
                          ? disagreeVotes.map((vote) => <span key={vote.participantId} className="rounded-md border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm">{vote.participantName}</span>)
                          : <span className="text-xs text-muted-foreground">Belum ada pemain</span>}
                      </div>
                    </div>
                  </div>
                )}

                {state.round?.status === "Debate" && (
                  <div className="space-y-4 rounded-md border bg-muted/30 p-4 sm:p-5">
                    <div className="flex flex-col items-center gap-3">
                      {renderMicControl()}

                      <textarea
                        value={transcriptText}
                        onChange={(event) => setTranscriptText(event.target.value)}
                        placeholder="Tulis argumenmu, atau gunakan mic untuk transcribe otomatis."
                        className="w-full resize-none border-0 bg-transparent p-0 text-center text-xl outline-none placeholder:text-muted-foreground focus-visible:ring-0 [field-sizing:content] dark:bg-transparent"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={() => saveTranscript()} disabled={isPending || isTranscribing || !transcriptText.trim()} variant="outline" size="icon" className="size-9 rounded-full bg-background">
                        <HugeiconsIcon icon={SaveIcon} strokeWidth={2} className="size-4" />
                      </Button>
                    </div>

                    {recorderMessage && (
                      <p className={`text-center text-xs ${recorderMessage.includes("gagal") || recorderMessage.includes("Tidak") ? "text-destructive" : "text-primary"}`}>{recorderMessage}</p>
                    )}
                  </div>
                )}

                {!state.round && state.lastResult && (
                  <div className="space-y-3 rounded-md border bg-muted/30 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">AI scoring ronde terakhir</p>
                        <p className="mt-1 text-sm font-semibold">{state.lastResult.statement}</p>
                      </div>
                      <span className="shrink-0 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {state.lastResult.transcriptCount} transcript
                      </span>
                    </div>
                    {resultScore ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">{resultScore.summary}</p>
                        <div className="space-y-2">
                          {resultScore.participants
                            .slice()
                            .sort((a, b) => b.score - a.score)
                            .map((item) => {
                              const participant = state.participants.find((p) => p.id === item.participantId);
                              const isWinner = resultScore.winnerParticipantId === item.participantId;
                              return (
                                <div key={item.participantId} className={`rounded-md border bg-background p-3 ${isWinner ? "border-primary/40" : ""}`}>
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="truncate text-sm font-semibold">{participant?.name ?? "Peserta"}{isWinner ? " · Winner" : ""}</p>
                                    <span className="text-lg font-bold text-primary">{Math.round(item.score)}</span>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ) : state.lastResult.aiScoreError ? (
                      <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{state.lastResult.aiScoreError}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">AI scoring belum tersedia.</p>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
          {message && <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</p>}
        </section>
      </div>
    </main>
  );
}
