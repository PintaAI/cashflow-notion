"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiGameIcon,
  AnalyticsUpIcon,
  BubbleChatSparkIcon,
  CheckmarkCircle04Icon,
  Clock01Icon,
  Delete02Icon,
  PencilEdit01Icon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/lib/auth-client";

import { createStatieRoom, deleteStatieStatement, joinStatieRoom } from "@/app/actions/statie";
import type { getStatiePopularTopics, getStatieStatements } from "@/app/actions/statie";

type Statement = Awaited<ReturnType<typeof getStatieStatements>>;
type PopularTopic = Awaited<ReturnType<typeof getStatiePopularTopics>>[number];

const TIME_PRESETS = [300, 600, 900, 1800, 3600];
const FALLBACK_TOPICS = ["kerja remote", "dating", "uang", "AI", "teknologi"];

function parseTopicsLocal(input: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of input.split(",")) {
    const normalized = raw.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export function StatieHome({ statements, popularTopics, isAdmin }: { statements: Statement; popularTopics: PopularTopic[]; isAdmin: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [debateSeconds, setDebateSeconds] = useState(900);
  const [customDebateMinutes, setCustomDebateMinutes] = useState("");
  const [message, setMessage] = useState("");
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const { data: session, isPending: sessionPending } = useSession();
  const isGuest = !sessionPending && !session;

  const selectedStatement = statements.find((s) => s.id === selectedStatementId) ?? null;
  const topicString = topics.join(", ");
  const topicSuggestions = popularTopics.length > 0 ? popularTopics.map((item) => item.topic) : FALLBACK_TOPICS;

  function createRoom() {
    setMessage("");
    startTransition(async () => {
      const result = await createStatieRoom({
        topic: topicString || "random",
        leaderName: name,
        debateSeconds,
        statementId: selectedStatementId ?? undefined,
      });
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      router.push(`/statie/${result.code}`);
    });
  }

  function pickStatement(statement: { id: string; topic: string }) {
    setSelectedStatementId((current) => (current === statement.id ? null : statement.id));
    setTopics((current) => {
      const key = statement.topic.toLowerCase();
      return current.some((t) => t.toLowerCase() === key) ? current : [...current, statement.topic];
    });
  }

  function addTopic(topic: string) {
    const normalized = topic.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    setTopics((current) => (current.some((t) => t.toLowerCase() === key) ? current : [...current, normalized]));
  }

  function removeTopic(topic: string) {
    const key = topic.toLowerCase();
    setTopics((current) => current.filter((t) => t.toLowerCase() !== key));
    setSelectedStatementId((current) => {
      if (!current) return null;
      const statement = statements.find((s) => s.id === current);
      return statement && statement.topic.toLowerCase() === key ? null : current;
    });
  }

  function commitTopicInput() {
    const parsed = parseTopicsLocal(topicInput);
    if (parsed.length === 0) return;
    for (const t of parsed) addTopic(t);
    setTopicInput("");
  }

  function removeStatement(statementId: string) {
    setMessage("");
    startTransition(async () => {
      const result = await deleteStatieStatement(statementId);
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      if (selectedStatementId === statementId) setSelectedStatementId(null);
      router.refresh();
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
    <div className="mx-auto max-w-7xl px-4 py-4 sm:py-8">
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={AiGameIcon} strokeWidth={2} className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Statie</h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5">
        <section className="pt-2 sm:py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4 sm:gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:gap-2 sm:text-xs">
              <HugeiconsIcon icon={BubbleChatSparkIcon} size={14} className="text-muted-foreground" />
              <span className="font-medium text-muted-foreground/70">AI Argumen</span>
              <span className="mx-0.5 text-muted-foreground/40">|</span>
              <HugeiconsIcon icon={UserGroupIcon} size={14} className="text-muted-foreground" />
              <span className="font-medium text-muted-foreground/70">social debate</span>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight transition-all sm:text-3xl md:text-4xl">
              Debat Singkat, Cuma game no Baper ;v
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground/70 sm:text-sm sm:leading-6">
         ini game buat kamu yang suka debat ringan, biar kita yang siapin topik atau terserah kamu topiknya, Bisa debat langsung via Discord ,zoom, Call Whatsapp
            </p>
          </div>
        </section>

        {message && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {message}
          </p>
        )}

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
              {isGuest && (
                <label className="space-y-1.5 text-xs text-muted-foreground">
                  Nama display
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Contoh: Raka"
                    className="h-10 bg-background"
                  />
                </label>
              )}

              {session && (
                <div className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-2">
                  <HugeiconsIcon icon={UserGroupIcon} size={14} className="shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs text-muted-foreground">
                    {session.user.name || session.user.email}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Topik room</label>
                <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5">
                  {topics.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => removeTopic(item)}
                      className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      {item} ×
                    </button>
                  ))}
                  <input
                    value={topicInput}
                    onChange={(event) => setTopicInput(event.target.value)}
                    onBlur={commitTopicInput}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== ",") return;
                      event.preventDefault();
                      commitTopicInput();
                    }}
                    placeholder={topics.length === 0 ? "Kosong = random, atau ketik topik" : "Tambah topik"}
                    className="h-7 min-w-32 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
                  />
                </div>

                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                  {topicSuggestions.slice(0, 5).map((suggestion, i) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => addTopic(suggestion)}
                      className={`rounded-full border bg-background px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary ${i >= 4 ? "hidden sm:block" : ""}`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {selectedStatement && (
                <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
                  <HugeiconsIcon icon={CheckmarkCircle04Icon} size={16} className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-primary">Argumen terpilih</p>
                    <p className="truncate text-xs text-muted-foreground">{selectedStatement.text}</p>
                  </div>
                  <button
                    onClick={() => setSelectedStatementId(null)}
                    className="ml-auto shrink-0 text-[11px] text-muted-foreground underline"
                  >
                    Lepas
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Timer debat</p>
                <label className={`flex w-full items-center rounded-full border bg-background px-3 py-2 text-xs font-semibold transition-colors ${!TIME_PRESETS.includes(debateSeconds) ? "border-primary text-primary" : "text-muted-foreground"}`}>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={customDebateMinutes}
                    onChange={(event) => {
                      setCustomDebateMinutes(event.target.value);
                      setDebateSeconds(Number(event.target.value) * 60);
                    }}
                    placeholder="Custom (menit)"
                    className="h-4 w-full border-0 bg-transparent p-0 text-center text-xs font-semibold shadow-none focus-visible:ring-0"
                  />
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {TIME_PRESETS.map((seconds) => {
                    const active = debateSeconds === seconds;
                    return (
                      <button
                        key={seconds}
                        type="button"
                        onClick={() => {
                          setDebateSeconds(seconds);
                          setCustomDebateMinutes("");
                        }}
                        className={`rounded-full border px-2 py-1.5 text-xs font-semibold transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"}`}
                      >
                        {seconds === 3600 ? "1h" : `${seconds / 60}m`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button onClick={createRoom} disabled={isPending} className="mt-1 h-10 w-full">
                Buat Room
              </Button>
            </TabsContent>

            <TabsContent value="join" className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Masuk dengan kode 6 karakter dari teman untuk ikut debat.
              </p>

              {isGuest && (
                <label className="space-y-1.5 text-xs text-muted-foreground">
                  Nama display
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Contoh: Raka"
                    className="h-10 bg-background"
                  />
                </label>
              )}

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Kode room</label>
                <Input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="ABC123"
                  className="h-14 bg-background text-center text-xl font-bold uppercase tracking-[0.3em]"
                />
              </div>

              <Button
                variant="outline"
                onClick={joinRoom}
                disabled={isPending}
                className="h-10 w-full bg-background"
              >
                Gabung Room
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        {statements.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <HugeiconsIcon icon={AnalyticsUpIcon} strokeWidth={2} className="size-4" />
                  Trending
                </p>
                <p className="text-xs text-muted-foreground">Top 10 trending argumen</p>
              </div>
              <span className="text-xs text-muted-foreground">{statements.length} argumen</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {statements.map((statement) => {
                const voteCount = statement.agreeCount + statement.disagreeCount;
                const isSelected = selectedStatementId === statement.id;
                return (
                  <div
                    key={statement.id}
                    className={`group relative flex flex-col gap-2.5 rounded-md border p-3 transition-colors ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "bg-muted/30 hover:bg-muted/50"}`}
                  >
                    {isSelected && (
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        <HugeiconsIcon icon={CheckmarkCircle04Icon} size={12} strokeWidth={2} />
                        Terpilih
                      </span>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        disabled={isPending}
                        aria-label="Hapus argumen"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeStatement(statement.id);
                        }}
                        className="absolute left-2 top-2 inline-flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={12} strokeWidth={2} className="size-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => pickStatement(statement)}
                      disabled={isPending}
                      className="flex flex-1 flex-col gap-2.5 text-left disabled:opacity-50"
                    >
                      <div className="flex items-start gap-2">
                        <HugeiconsIcon
                          icon={statement.generatedByAi ? BubbleChatSparkIcon : PencilEdit01Icon}
                          size={14}
                          className="mt-0.5 shrink-0 text-muted-foreground"
                        />
                        <p className="text-sm font-medium leading-5">{statement.text}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 font-medium">
                          {statement.topic}
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                          <HugeiconsIcon icon={ThumbsUpIcon} size={12} strokeWidth={2} />
                          {statement.agreeCount}
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                          <HugeiconsIcon icon={ThumbsDownIcon} size={12} strokeWidth={2} />
                          {statement.disagreeCount}
                        </span>
                        <span className="text-muted-foreground/60">
                          {voteCount} vote · {statement.usedCount}× dipakai
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
