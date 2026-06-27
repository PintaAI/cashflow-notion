"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiGameIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/lib/auth-client";
import { createWerewolfRoom, joinWerewolfRoom } from "@/app/actions/werewolf";

export function WerewolfHome() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [hasModerator, setHasModerator] = useState(true);
  const [playerLimit, setPlayerLimit] = useState(10);
  const [nightSeconds, setNightSeconds] = useState(60);
  const [daySeconds, setDaySeconds] = useState(120);
  const [revoteSeconds, setRevoteSeconds] = useState(30);
  const [message, setMessage] = useState("");
  const { data: session, isPending: sessionPending } = useSession();
  const isGuest = !sessionPending && !session;

  function createRoom() {
    setMessage("");
    startTransition(async () => {
      const result = await createWerewolfRoom({ leaderName: name, hasModerator, playerLimit, nightSeconds, daySeconds, revoteSeconds });
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
            Buat room dengan moderator khusus, atau ikut bermain sebagai host sambil tetap bisa mengontrol fase.
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

            <TabsContent value="create" className="space-y-4 pt-2">
              {isGuest ? (
                <label className="flex items-center gap-3 rounded-md border bg-background px-4 py-3">
                  <span className="text-xs font-medium text-muted-foreground">Nama</span>
                  <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Raka" className="h-9 flex-1 bg-muted/50" />
                </label>
              ) : (
                <div className="flex items-center gap-3 rounded-md border bg-background px-4 py-3 text-xs">
                  <span className="font-medium text-muted-foreground">Masuk sebagai</span>
                  <span className="text-foreground">{session?.user.name || session?.user.email}</span>
                </div>
              )}

              <div className="rounded-md border bg-background p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <label htmlFor="moderator-switch" className="text-sm font-medium">Moderator</label>
                    <p className="text-xs text-muted-foreground">{hasModerator ? "Game akan diatur oleh room leader sebagai moderator" : "Fase siang akan diatur oleh sistem dan durasi fase bisa diatur"}</p>
                  </div>
                  <Switch id="moderator-switch" checked={hasModerator} onCheckedChange={setHasModerator} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Limit</span>
                  <Input
                    type="number"
                    min={4}
                    max={16}
                    value={playerLimit}
                    onChange={(event) => setPlayerLimit(Number(event.target.value))}
                    className="h-8 w-16 bg-muted/50 text-center"
                  />
                  <span className="text-xs text-muted-foreground">pemain</span>
                </div>
              </div>

              {!hasModerator && (
                <div className="rounded-md border bg-background p-4">
                  <h3 className="mb-3 text-xs font-semibold text-muted-foreground">DURASI FASE</h3>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Malam</span>
                      <Select value={String(nightSeconds)} onValueChange={(v) => setNightSeconds(Number(v))}>
                        <SelectTrigger className="h-8 w-24 bg-muted/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 dtk</SelectItem>
                          <SelectItem value="30">30 dtk</SelectItem>
                          <SelectItem value="45">45 dtk</SelectItem>
                          <SelectItem value="60">1 mnt</SelectItem>
                          <SelectItem value="90">1,5 mnt</SelectItem>
                          <SelectItem value="120">2 mnt</SelectItem>
                          <SelectItem value="180">3 mnt</SelectItem>
                          <SelectItem value="300">5 mnt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Siang</span>
                      <Select value={String(daySeconds)} onValueChange={(v) => setDaySeconds(Number(v))}>
                        <SelectTrigger className="h-8 w-24 bg-muted/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 dtk</SelectItem>
                          <SelectItem value="60">1 mnt</SelectItem>
                          <SelectItem value="90">1,5 mnt</SelectItem>
                          <SelectItem value="120">2 mnt</SelectItem>
                          <SelectItem value="180">3 mnt</SelectItem>
                          <SelectItem value="240">4 mnt</SelectItem>
                          <SelectItem value="300">5 mnt</SelectItem>
                          <SelectItem value="600">10 mnt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Revote</span>
                      <Select value={String(revoteSeconds)} onValueChange={(v) => setRevoteSeconds(Number(v))}>
                        <SelectTrigger className="h-8 w-24 bg-muted/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 dtk</SelectItem>
                          <SelectItem value="15">15 dtk</SelectItem>
                          <SelectItem value="20">20 dtk</SelectItem>
                          <SelectItem value="30">30 dtk</SelectItem>
                          <SelectItem value="45">45 dtk</SelectItem>
                          <SelectItem value="60">1 mnt</SelectItem>
                          <SelectItem value="90">1,5 mnt</SelectItem>
                          <SelectItem value="120">2 mnt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={createRoom} disabled={isPending} className="h-10 w-full">
                {hasModerator ? "Buat Room sebagai Moderator" : "Buat Room sebagai Pemain"}
              </Button>
            </TabsContent>

            <TabsContent value="join" className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">Masukkan kode room 6 karakter dari host.</p>
              {isGuest && (
                <div className="space-y-2 rounded-md border bg-background p-4">
                  <label className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">Nama</span>
                    <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Raka" className="h-9 flex-1 bg-muted/50" />
                  </label>
                </div>
              )}
              <div className="space-y-2 rounded-md border bg-background p-4">
                <label className="flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Kode Room</span>
                  <Input
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                    placeholder="ABC123"
                    className="h-14 bg-muted/50 text-center text-xl font-bold uppercase tracking-[0.3em]"
                  />
                </label>
              </div>
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
