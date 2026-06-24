"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiGameIcon, Clock01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/lib/auth-client";
import { createWerewolfRoom, joinWerewolfRoom } from "@/app/actions/werewolf";

export function WerewolfHome() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [playerLimit, setPlayerLimit] = useState(10);
  const [nightSeconds, setNightSeconds] = useState(60);
  const [daySeconds, setDaySeconds] = useState(120);
  const [votingSeconds, setVotingSeconds] = useState(60);
  const [revoteSeconds, setRevoteSeconds] = useState(30);
  const [message, setMessage] = useState("");
  const { data: session, isPending: sessionPending } = useSession();
  const isGuest = !sessionPending && !session;

  function createRoom() {
    setMessage("");
    startTransition(async () => {
      const result = await createWerewolfRoom({ leaderName: name, playerLimit, nightSeconds, daySeconds, votingSeconds, revoteSeconds });
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      router.push(`/werewolf-multiplayer/${result.code}`);
    });
  }

  function joinRoom() {
    setMessage("");
    startTransition(async () => {
      const result = await joinWerewolfRoom(joinCode, name);
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      router.push(`/werewolf-multiplayer/${result.code}`);
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="rounded-2xl border bg-gradient-to-br from-zinc-950 via-slate-900 to-red-950 p-5 text-white shadow-sm sm:p-7">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-red-200/80">
            <HugeiconsIcon icon={AiGameIcon} strokeWidth={2} className="size-4" />
            Werewolf Multiplayer
          </div>
          <h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">
            Desa gelap, semua orang mencurigakan.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300">
            Buat room, bagi role rahasia. Sistem mengatur fase malam, diskusi, dan voting lewat timer. Leader juga bisa majuin fase manual.
          </p>
        </section>

        {message && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</p>}

        <div className="rounded-md border bg-muted/30 p-2 sm:p-3">
          <Tabs defaultValue="create" className="gap-3">
            <TabsList variant="line" className="w-full">
              <TabsTrigger value="create">
                <HugeiconsIcon icon={AiGameIcon} size={14} strokeWidth={2} />
                Buat room
              </TabsTrigger>
              <TabsTrigger value="join">
                <HugeiconsIcon icon={UserGroupIcon} size={14} strokeWidth={2} />
                Gabung room
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-3 pt-2">
              {isGuest ? (
                <label className="space-y-1.5 text-xs text-muted-foreground">
                  Nama display
                  <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Raka" className="h-10 bg-background" />
                </label>
              ) : (
                <div className="rounded-md border border-border/50 px-3 py-2 text-xs text-muted-foreground">
                  Kamu masuk sebagai {session?.user.name || session?.user.email}.
                </div>
              )}

              <label className="space-y-1.5 text-xs text-muted-foreground">
                Limit pemain (4-16)
                <Input
                  type="number"
                  min={4}
                  max={16}
                  value={playerLimit}
                  onChange={(event) => setPlayerLimit(Number(event.target.value))}
                  className="h-10 bg-background"
                />
              </label>

              <div className="rounded-md border border-border/50 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <HugeiconsIcon icon={Clock01Icon} size={14} strokeWidth={2} className="size-3.5" />
                  Durasi tiap fase (detik)
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Malam
                    <Input type="number" min={15} max={300} value={nightSeconds} onChange={(event) => setNightSeconds(Number(event.target.value))} className="h-9 bg-background" />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Siang
                    <Input type="number" min={30} max={600} value={daySeconds} onChange={(event) => setDaySeconds(Number(event.target.value))} className="h-9 bg-background" />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Voting
                    <Input type="number" min={15} max={300} value={votingSeconds} onChange={(event) => setVotingSeconds(Number(event.target.value))} className="h-9 bg-background" />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Revote
                    <Input type="number" min={10} max={120} value={revoteSeconds} onChange={(event) => setRevoteSeconds(Number(event.target.value))} className="h-9 bg-background" />
                  </label>
                </div>
              </div>

              <Button onClick={createRoom} disabled={isPending} className="h-10 w-full">
                Buat Room Werewolf
              </Button>
            </TabsContent>

            <TabsContent value="join" className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">Masuk dengan kode 6 karakter dari leader.</p>
              {isGuest && (
                <label className="space-y-1.5 text-xs text-muted-foreground">
                  Nama display
                  <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Raka" className="h-10 bg-background" />
                </label>
              )}
              <label className="space-y-1.5 text-xs text-muted-foreground">
                Kode room
                <Input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="ABC123"
                  className="h-14 bg-background text-center text-xl font-bold uppercase tracking-[0.3em]"
                />
              </label>
              <Button variant="outline" onClick={joinRoom} disabled={isPending} className="h-10 w-full bg-background">
                Gabung Room
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
