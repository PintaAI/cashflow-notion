"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth-client";

import {
  finishStatieRound,
  getStatieRoomState,
  joinStatieRoom,
  startStatieDebate,
  startStatieRound,
  submitStatieVote,
} from "@/app/actions/statie";

type RoomState = Awaited<ReturnType<typeof getStatieRoomState>>;
type VoteChoice = "Agree" | "Disagree";

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const rest = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function StatieRoom({ code }: { code: string }) {
  const [state, setState] = useState<RoomState>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();
  const { data: session, isPending: sessionPending } = useSession();
  const isGuest = !sessionPending && !session;

  async function refresh() {
    const nextState = await getStatieRoomState(code);
    setState(nextState);
  }

  useEffect(() => {
    let active = true;
    const loadState = async () => {
      const nextState = await getStatieRoomState(code);
      if (active) setState(nextState);
    };

    void loadState();
    const poll = window.setInterval(() => void loadState(), 1500);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [code]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const votes = state?.round?.votes ?? [];
  const agreeVotes = votes.filter((vote) => vote.choice === "Agree");
  const disagreeVotes = votes.filter((vote) => vote.choice === "Disagree");
  const votedCount = votes.length;
  const totalPlayers = state?.participants.length ?? 0;
  const debateSecondsLeft = state?.round?.debateEndsAt ? Math.ceil((new Date(state.round.debateEndsAt).getTime() - now) / 1000) : 0;
  const shareUrl = useMemo(() => (typeof window === "undefined" ? "" : `${window.location.origin}/statie/${code}`), [code]);

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

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

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
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 sm:py-6 lg:grid-cols-[280px_1fr_320px]">
        <aside className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Room code</p>
            <h1 className="text-3xl font-bold tracking-[0.12em]">{state.code}</h1>
          </div>
          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Topik</p>
            <p className="mt-1 font-bold">{state.topic}</p>
          </div>
          <Button onClick={copyLink} variant="outline" className="w-full">
            {copied ? "Link disalin" : "Salin link"}
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/statie">Buat room lain</Link>
          </Button>
        </aside>

        <section className="min-h-[70dvh] rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          {!state.isJoined ? (
            <div className="mx-auto flex min-h-[58dvh] max-w-md flex-col justify-center gap-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">Gabung room</p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {isGuest ? "Pilih nama sebelum ikut kubu." : "Gabung dengan akunmu."}
              </h2>
              {session && <p className="text-sm text-muted-foreground">Kamu masuk sebagai {session.user.name || session.user.email}.</p>}
              {isGuest && <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama display" className="h-10 text-center" />}
              <Button onClick={joinRoom} disabled={isPending} className="h-10">
                Gabung Room
              </Button>
            </div>
          ) : (
            <div className="flex min-h-[58dvh] flex-col justify-between gap-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{state.status}</p>
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{state.round ? "Statement ronde ini" : "Lobby"}</h2>
                  </div>
                  {state.round?.status === "Debate" && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-2xl font-bold tabular-nums text-destructive">
                      {formatTime(debateSecondsLeft)}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border bg-muted/40 p-5 sm:p-6">
                  {state.round ? (
                    <p className="text-2xl font-bold leading-tight tracking-tight sm:text-4xl">{state.round.statement}</p>
                  ) : (
                    <p className="text-lg font-medium leading-7 text-muted-foreground">Tunggu leader mulai ronde. AI akan memilih statement berdasarkan topik room.</p>
                  )}
                </div>

                {state.round?.status === "Voting" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button onClick={() => vote("Agree")} disabled={isPending} className={`rounded-xl border p-5 text-left transition hover:bg-muted/60 disabled:opacity-50 ${state.round.myVote === "Agree" ? "border-primary bg-primary/10 text-primary" : "bg-card"}`}>
                      <span className="text-xs font-medium text-muted-foreground">Setuju</span>
                      <span className="mt-4 block text-2xl font-bold">Iya, benar.</span>
                    </button>
                    <button onClick={() => vote("Disagree")} disabled={isPending} className={`rounded-xl border p-5 text-left transition hover:bg-muted/60 disabled:opacity-50 ${state.round.myVote === "Disagree" ? "border-destructive bg-destructive/10 text-destructive" : "bg-card"}`}>
                      <span className="text-xs font-medium text-muted-foreground">Tidak setuju</span>
                      <span className="mt-4 block text-2xl font-bold">Nggak dulu.</span>
                    </button>
                  </div>
                )}

                {state.round && state.round.status !== "Voting" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                      <p className="text-xs font-medium text-muted-foreground">Kubu Setuju</p>
                      <p className="text-4xl font-bold text-primary">{agreeVotes.length}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {agreeVotes.map((vote) => <span key={vote.participantId} className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium">{vote.participantName}</span>)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                      <p className="text-xs font-medium text-muted-foreground">Kubu Tidak Setuju</p>
                      <p className="text-4xl font-bold text-destructive">{disagreeVotes.length}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {disagreeVotes.map((vote) => <span key={vote.participantId} className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium">{vote.participantName}</span>)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-3">
                <p className="text-sm text-muted-foreground">Vote masuk: <span className="font-bold text-foreground">{votedCount}/{totalPlayers}</span></p>
                {state.isLeader && (
                  <div className="flex flex-wrap gap-2">
                    {!state.round && <Button onClick={() => runAction(() => startStatieRound(code))} disabled={isPending}>Mulai ronde</Button>}
                    {state.round?.status === "Voting" && <Button onClick={() => runAction(() => startStatieDebate(code))} disabled={isPending}>Split & debat</Button>}
                    {state.round && <Button onClick={() => runAction(() => finishStatieRound(code))} disabled={isPending} variant="outline">Selesai ronde</Button>}
                  </div>
                )}
              </div>
            </div>
          )}
          {message && <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</p>}
        </section>

        <aside className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Players</p>
              <h3 className="text-2xl font-bold tracking-tight">{state.participants.length} orang</h3>
            </div>
            <p className="rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground">{state.debateSeconds}s</p>
          </div>
          <div className="space-y-2">
            {state.participants.map((participant) => (
              <div key={participant.id} className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-3 py-2.5">
                <span className="truncate text-sm font-medium">{participant.name}</span>
                {participant.isLeader && <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground">Leader</span>}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
