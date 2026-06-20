"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth-client";

import { createStatieRoom, joinStatieRoom } from "@/app/actions/statie";

export function StatieHome() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [topic, setTopic] = useState("");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [debateSeconds, setDebateSeconds] = useState(120);
  const [message, setMessage] = useState("");
  const { data: session, isPending: sessionPending } = useSession();
  const isGuest = !sessionPending && !session;

  function createRoom() {
    setMessage("");
    startTransition(async () => {
      const result = await createStatieRoom({ topic, leaderName: name, debateSeconds });
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      router.push(`/statie/${result.code}`);
    });
  }

  function joinRoom() {
    setMessage("");
    startTransition(async () => {
      const result = await joinStatieRoom(joinCode, name);
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      router.push(`/statie/${result.code}`);
    });
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col justify-center gap-6 px-4 py-6 sm:py-10 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
          <div className="inline-flex rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Social game
          </div>

          <div className="space-y-3">
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Statie, room debat ringan buat pecah kubu.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Pilih topik, undang teman lewat link atau kode, lalu AI akan memberi statement acak. Pemain memilih Setuju atau Tidak Setuju sebelum timer debat dimulai.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-primary/10 p-4">
              <p className="text-xs font-medium text-muted-foreground">Langkah 1</p>
              <p className="mt-1 font-bold">Pilih topik</p>
            </div>
            <div className="rounded-xl border bg-secondary/40 p-4">
              <p className="text-xs font-medium text-muted-foreground">Langkah 2</p>
              <p className="mt-1 font-bold">Vote kubu</p>
            </div>
            <div className="rounded-xl border bg-accent/40 p-4">
              <p className="text-xs font-medium text-muted-foreground">Langkah 3</p>
              <p className="mt-1 font-bold">Mulai debat</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Mulai Statie</h2>
              <p className="text-sm text-muted-foreground">
                {session ? `Kamu masuk sebagai ${session.user.name || session.user.email}.` : "Guest perlu mengisi nama display sebelum bermain."}
              </p>
            </div>

            {isGuest && (
              <label className="space-y-2 text-sm font-medium">
                Nama display
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Raka" className="h-10" />
              </label>
            )}

            <div className="grid gap-3 rounded-xl border bg-muted/40 p-4">
              <label className="space-y-2 text-sm font-medium">
                Topik room
                <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Contoh: kerja remote, dating, uang" className="h-10" />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Timer debat (menit)
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={Math.round(debateSeconds / 60)}
                  onChange={(event) => setDebateSeconds(Number(event.target.value) * 60)}
                  placeholder="1-60"
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">Maksimal 60 menit.</p>
              </label>
              <Button onClick={createRoom} disabled={isPending} className="h-10 w-full">
                Buat Room
              </Button>
            </div>

            <div className="grid gap-3 rounded-xl border p-4">
              <label className="space-y-2 text-sm font-medium">
                Punya kode?
                <Input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABC123" className="h-10 text-center font-bold uppercase tracking-[0.25em]" />
              </label>
              <Button variant="outline" onClick={joinRoom} disabled={isPending} className="h-10 w-full">
                Gabung Room
              </Button>
            </div>

            {message && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
