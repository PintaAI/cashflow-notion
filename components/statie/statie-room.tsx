"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiGameIcon,
  BubbleChatSparkIcon,
  Clock01Icon,
  CogIcon,
  CopyLinkIcon,
  Delete02Icon,
  PencilEdit01Icon,
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
  updateStatieRoomTopic,
} from "@/app/actions/statie";

type RoomState = Awaited<ReturnType<typeof getStatieRoomState>>;
type ActiveRound = NonNullable<NonNullable<RoomState>["round"]>;
type VoteChoice = "Agree" | "Disagree";

const LOBBY_POLL_MS = 8000;
const ACTIVE_ROUND_POLL_MS = 2500;
const UNJOINED_POLL_MS = 12000;

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

function getPollingDelay(state: RoomState) {
  if (!state?.isJoined) return UNJOINED_POLL_MS;
  if (state.round?.status === "Debate") return null;
  if (state.round?.status === "Voting") return ACTIVE_ROUND_POLL_MS;
  return LOBBY_POLL_MS;
}

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
  const finishAfterTranscribeRef = useRef(false);
  const { data: session, isPending: sessionPending } = useSession();
  const isGuest = !sessionPending && !session;

  function applyRoomState(nextState: RoomState) {
    setState(nextState);
    if (nextState) setPlayerLimitInput(nextState.playerLimit);
    setNextTopic((current) => current || nextState?.topic || "");

    const roundId = nextState?.round?.id ?? null;
    if (transcriptRoundIdRef.current !== roundId) {
      transcriptRoundIdRef.current = roundId;
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
    let loading = false;
    let timeout: number | undefined;
    let latestState: RoomState = null;

    const scheduleNextLoad = () => {
      if (!active || document.hidden) return;
      const delay = getPollingDelay(latestState);
      if (delay === null) return;
      timeout = window.setTimeout(() => void loadState(), delay);
    };

    const loadState = async () => {
      if (loading) return;
      if (document.hidden) return;
      loading = true;
      try {
        const nextState = await getStatieRoomState(code);
        if (active) {
          latestState = nextState;
          applyRoomState(nextState);
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
  const votedCount = votes.length;
  const totalPlayers = state?.participants.length ?? 0;
  const votingSecondsLeft = state?.round?.votingEndsAt ? Math.ceil((new Date(state.round.votingEndsAt).getTime() - now) / 1000) : 0;
  const debateSecondsLeft = state?.round?.debateEndsAt ? Math.ceil((new Date(state.round.debateEndsAt).getTime() - now) / 1000) : 0;
  const shareUrl = useMemo(() => (typeof window === "undefined" ? "" : `${window.location.origin}/statie/${code}`), [code]);
  const resultScore = getAiScore(state?.lastResult?.aiScore);

  function runAction(action: () => Promise<{ success: boolean; message?: string }>) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      if (!result.success) setMessage(result.message ?? "Aksi gagal.");
      await refresh();
    });
  }

  function joinRoom() {
    runAction(() => joinStatieRoom(code, name));
  }

  function vote(choice: VoteChoice) {
    runAction(() => submitStatieVote(code, choice));
  }

  function finishRoundAction() {
    runAction(() => finishStatieRound(code));
  }

  function saveTranscript(text = transcriptText) {
    const roundId = state?.round?.id;
    if (!roundId) return;
    runAction(() => submitStatieTranscript(code, roundId, text));
  }

  function changeTopic() {
    runAction(() => updateStatieRoomTopic(code, nextTopic));
  }

  function changePlayerLimit() {
    runAction(() => updateStatiePlayerLimit(code, playerLimitInput));
  }

  function kickParticipant(participantId: string) {
    runAction(() => kickStatieParticipant(code, participantId));
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
      setRecorderMessage("Mic siap. Rekaman akan otomatis mengikuti timer debat.");
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

  async function startRecording() {
    const round = state?.round;
    if (!round || isRecording) return;

    const stream = streamRef.current ?? await prepareMic();
    if (!stream) return;
    startRecordingForRound(round, stream);
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

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

  useEffect(() => {
    const round = state?.round;
    if (round?.status !== "Debate" || !streamRef.current || isRecording || isTranscribing) return;
    startRecordingForRound(round, streamRef.current);
    // Auto-start is intentionally keyed to the round transition, not every recorder helper identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.round?.id, state?.round?.status, isRecording, isTranscribing]);

  useEffect(() => {
    if (state?.round?.status === "Debate" && isRecording && debateSecondsLeft <= 0) stopRecording();
  }, [state?.round?.status, isRecording, debateSecondsLeft]);

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
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
                Statie Room
              </span>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <HugeiconsIcon icon={UserGroupIcon} size={14} className="text-muted-foreground" />
                <span className="font-medium text-muted-foreground/70">{state.participants.length}/{state.playerLimit}</span>
                <span className="hidden sm:inline">orang</span>
                <span className="mx-0.5 text-muted-foreground/40">|</span>
                <HugeiconsIcon icon={Clock01Icon} size={14} className="text-muted-foreground" />
                <span className="font-medium text-muted-foreground/70">{Math.round(state.debateSeconds / 60)}</span>
                <span className="hidden sm:inline">menit</span>
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
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-[0.16em] transition-all sm:text-3xl md:text-4xl">
                  {state.code}
                </h1>
                <p className="mt-1 truncate text-xs text-muted-foreground/70">
                  {state.status} · {state.round ? "ronde aktif" : "menunggu ronde"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/statie">Room Baru</Link>
                </Button>
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{state.round ? "Topik dari" : "Topik"}</p>
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{state.topic}</h2>
                  </div>
                  {state.round?.status === "Debate" && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xl font-bold tabular-nums text-destructive">
                      {formatTime(debateSecondsLeft)}
                    </div>
                  )}
                </div>

                <div className="rounded-md border bg-muted/30 p-4 sm:p-5">
                  {state.round ? (
                    <div className="space-y-5">
                      <p className="text-xl font-bold leading-tight tracking-tight sm:text-3xl">{state.round.statement}</p>
                      <p className="text-sm text-muted-foreground">Vote masuk: <span className="font-bold text-foreground">{votedCount}/{totalPlayers}</span></p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium leading-6 text-muted-foreground">
                        <HugeiconsIcon icon={BubbleChatSparkIcon} size={16} className="text-muted-foreground" />
                        <span>{state.hasPendingStatement ? "Argumen tersimpan siap dipakai." : "Tunggu leader mulai ronde. AI akan pilih argumen acak."}</span>
                      </div>
                      {state.isLeader && (
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground">Tulis argumen sendiri (opsional)</label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              value={customStatement}
                              onChange={(event) => setCustomStatement(event.target.value)}
                              placeholder="Contoh: Nasi padang harus pakai tangan."
                              className="h-9 min-w-0 flex-1 bg-background"
                              maxLength={180}
                            />
                            <Button
                              onClick={() => { runAction(() => startStatieRound(code, customStatement)); setCustomStatement(""); }}
                              disabled={isPending}
                              className="h-9 shrink-0"
                            >
                              <HugeiconsIcon icon={customStatement.trim() ? PencilEdit01Icon : AiGameIcon} strokeWidth={2} className="size-4" />
                              {customStatement.trim() ? "Pakai ini" : "Generate bahan Debat"}
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {state.participants.map((participant) => (
                          <span key={participant.id} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
                            {participant.name}
                            {participant.isLeader ? <span className="text-[10px] text-muted-foreground">Leader</span> : null}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {state.round?.status === "Voting" && (
                  <div className="space-y-4 rounded-md border bg-muted/30 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Voting time</p>
                        <p className="mt-1 text-xs text-muted-foreground">Yang belum vote akan dipilih acak saat waktu habis.</p>
                      </div>
                      <div className="rounded-md border bg-background px-3 py-2 text-xl font-bold tabular-nums text-primary">
                        {formatTime(votingSecondsLeft)}
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
                  </div>
                )}

                {state.round && state.round.status !== "Voting" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-primary/30 bg-primary/10 p-4 text-left">
                      <p className="text-xs font-medium text-muted-foreground">Kubu Setuju</p>
                      <p className="text-3xl font-bold text-primary">{agreeVotes.length}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {agreeVotes.map((vote) => <span key={vote.participantId} className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium">{vote.participantName}</span>)}
                      </div>
                    </div>
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-right">
                      <p className="text-xs font-medium text-muted-foreground">Kubu Tidak Setuju</p>
                      <p className="text-3xl font-bold text-destructive">{disagreeVotes.length}</p>
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        {disagreeVotes.map((vote) => <span key={vote.participantId} className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium">{vote.participantName}</span>)}
                      </div>
                    </div>
                  </div>
                )}

                {state.round && (state.round.status === "Voting" || state.round.status === "Debate") && (
                  <div className="space-y-3 rounded-md border bg-muted/30 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">AI transcript</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {state.round.status === "Voting"
                            ? "Aktifkan mic sekarang. Rekaman akan mulai otomatis saat debat dimulai dan berhenti saat timer habis."
                            : "Rekaman mengikuti timer debat. Whisper lokal akan ubah audio jadi text untuk scoring."}
                        </p>
                        <p className="mt-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 text-xs text-muted-foreground">
                          Mic digunakan untuk membuat transcript dan menilai hasil debat dengan AI scoring.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!isMicReady ? (
                          <Button onClick={prepareMic} disabled={isTranscribing} className="h-9">Aktifkan mic</Button>
                        ) : state.round.status === "Voting" ? (
                          <Button disabled className="h-9">Mic siap</Button>
                        ) : !isRecording ? (
                          <Button onClick={startRecording} disabled={isTranscribing} className="h-9">Mulai rekam sekarang</Button>
                        ) : (
                          <Button onClick={stopRecording} variant="outline" className="h-9 bg-background">Stop awal</Button>
                        )}
                        <Button onClick={() => saveTranscript()} disabled={isPending || isRecording || isTranscribing || !transcriptText.trim()} variant="outline" className="h-9 bg-background">
                          Simpan text
                        </Button>
                      </div>
                    </div>

                    <textarea
                      value={transcriptText}
                      onChange={(event) => setTranscriptText(event.target.value)}
                      placeholder="Transcript akan muncul di sini. Kalau mic/Whisper gagal, tulis ringkasan argumenmu manual."
                      className="min-h-28 w-full rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {isRecording && (
                      <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-primary">
                        <span className="text-xs font-semibold">Recording mengikuti timer debat</span>
                        <div className="flex h-6 items-center gap-1" aria-label="Recording audio indicator">
                          {[0, 1, 2, 3, 4, 5, 6].map((item) => (
                            <span
                              key={item}
                              className="w-1 rounded-full bg-primary animate-pulse"
                              style={{ height: `${8 + (item % 4) * 4}px`, animationDelay: `${item * 120}ms` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{state.round.transcriptCount} transcript tersimpan · {isMicReady ? "mic siap" : "mic belum aktif"}</span>
                      {recorderMessage ? <span className={recorderMessage.includes("gagal") || recorderMessage.includes("Tidak") ? "text-destructive" : "text-primary"}>{recorderMessage}</span> : null}
                    </div>
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

                {state.isLeader && (
                  <div className="flex justify-end">
                    {!state.round && <Button onClick={() => { runAction(() => startStatieRound(code, customStatement)); setCustomStatement(""); }} disabled={isPending} className="h-9">Mulai ronde</Button>}
                    {state.round?.status === "Voting" && <Button onClick={() => runAction(() => startStatieDebate(code))} disabled={isPending} className="h-9">Mulai debat</Button>}
                    {state.round?.status === "Debate" && <Button onClick={finishRound} disabled={isPending} variant="outline" className="h-9 bg-background">Selesai ronde & scoring</Button>}
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
