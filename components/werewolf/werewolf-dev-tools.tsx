"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CodeFolderIcon } from "@hugeicons/core-free-icons";

export interface WerewolfDevPatches {
  status?: string;
  myRole?: string | null;
  isAlive?: boolean;
  isJoined?: boolean;
  meId?: string | null;
  meName?: string | null;
  phaseEndsAtOffset?: number | null;
  phaseEndsAt?: string | null;
  finishedReason?: string | null;
  phaseNumber?: number;
  currentVoteRound?: number;
  lastEliminatedName?: string | null;
  nightActionSubmitted?: boolean;
  votedCount?: number;
  aliveCount?: number;
  myKillTargetId?: string | null;
  mySeerCheckTargetId?: string | null;
  myVoteTargetId?: string | null;
  fellowWerewolves?: Array<{ id: string; name: string }> | null;
  mySeerChecks?: Array<{ phaseNumber: number; targetName: string; inspectedRole: string }> | null;
  revoteCandidateIds?: string[] | null;
  participantOverrides?: Record<
    string,
    { isAlive?: boolean; voteCount?: number; hasVoted?: boolean; role?: string | null }
  >;
  mockParticipants?: Array<{
    id: string;
    name: string;
    isAlive: boolean;
    isLeader?: boolean;
    role?: string | null;
    voteCount?: number;
    hasVoted?: boolean;
  }>;
}

const PHASES = ["Lobby", "Night", "Day", "Voting", "Revote", "Finished"];
const ROLES = ["Werewolf", "Seer", "Villager"];
const PRESETS: { label: string; patches: WerewolfDevPatches }[] = [
  {
    label: "Masuk (join)",
    patches: { status: "Lobby", isAlive: true, myRole: null, meId: undefined, meName: undefined, myKillTargetId: null, mySeerCheckTargetId: null, myVoteTargetId: null, nightActionSubmitted: false, lastEliminatedName: null, finishedReason: null, phaseEndsAtOffset: null, fellowWerewolves: null, mySeerChecks: null, revoteCandidateIds: null, votedCount: undefined, aliveCount: undefined },
  },
  {
    label: "Malam 1 (Werewolf)",
    patches: { status: "Night", phaseNumber: 1, myRole: "Werewolf", isAlive: true, phaseEndsAtOffset: 45, nightActionSubmitted: false, myKillTargetId: null, mySeerCheckTargetId: null, myVoteTargetId: null, lastEliminatedName: null, finishedReason: null, fellowWerewolves: [], mySeerChecks: null, revoteCandidateIds: null, votedCount: undefined, aliveCount: undefined },
  },
  {
    label: "Malam 2 (Werewolf)",
    patches: { status: "Night", phaseNumber: 2, myRole: "Werewolf", isAlive: true, phaseEndsAtOffset: 45, nightActionSubmitted: false, myKillTargetId: null, mySeerCheckTargetId: null, myVoteTargetId: null, lastEliminatedName: null, finishedReason: null, fellowWerewolves: [], mySeerChecks: null, revoteCandidateIds: null, votedCount: undefined, aliveCount: undefined },
  },
  {
    label: "Malam 1 (Seer)",
    patches: { status: "Night", phaseNumber: 1, myRole: "Seer", isAlive: true, phaseEndsAtOffset: 45, nightActionSubmitted: false, myKillTargetId: null, mySeerCheckTargetId: null, myVoteTargetId: null, lastEliminatedName: null, finishedReason: null, fellowWerewolves: null, mySeerChecks: [], revoteCandidateIds: null, votedCount: undefined, aliveCount: undefined },
  },
  {
    label: "Malam 1 (Warga)",
    patches: { status: "Night", phaseNumber: 1, myRole: "Villager", isAlive: true, phaseEndsAtOffset: 45, nightActionSubmitted: false, myKillTargetId: null, mySeerCheckTargetId: null, myVoteTargetId: null, lastEliminatedName: null, finishedReason: null, fellowWerewolves: null, mySeerChecks: null, revoteCandidateIds: null, votedCount: undefined, aliveCount: undefined },
  },
  {
    label: "Siang (diskusi)",
    patches: { status: "Day", phaseEndsAtOffset: 90, myKillTargetId: null, mySeerCheckTargetId: null, myVoteTargetId: null, nightActionSubmitted: false, lastEliminatedName: null, finishedReason: null, revoteCandidateIds: null },
  },
  {
    label: "Voting",
    patches: { status: "Voting", phaseEndsAtOffset: 40, myKillTargetId: null, mySeerCheckTargetId: null, nightActionSubmitted: false, lastEliminatedName: null, finishedReason: null, revoteCandidateIds: null },
  },
  {
    label: "Revote",
    patches: { status: "Revote", phaseEndsAtOffset: 20, myKillTargetId: null, mySeerCheckTargetId: null, nightActionSubmitted: false, lastEliminatedName: null, finishedReason: null },
  },
  {
    label: "Selesai",
    patches: { status: "Finished", phaseEndsAtOffset: null, finishedReason: "Warga menang. Semua werewolf sudah tersingkir.", myKillTargetId: null, mySeerCheckTargetId: null, myVoteTargetId: null, nightActionSubmitted: false, lastEliminatedName: null, revoteCandidateIds: null },
  },
  {
    label: "Gugur",
    patches: { isAlive: false, myKillTargetId: null, mySeerCheckTargetId: null, myVoteTargetId: null },
  },
  {
    label: "8P: 5Warga 2Wolf 1Seer",
    patches: {
      status: "Lobby",
      myRole: null,
      isAlive: true,
      meId: undefined,
      meName: undefined,
      phaseEndsAtOffset: null,
      nightActionSubmitted: false,
      myKillTargetId: null,
      mySeerCheckTargetId: null,
      myVoteTargetId: null,
      lastEliminatedName: null,
      finishedReason: null,
      fellowWerewolves: null,
      mySeerChecks: null,
      revoteCandidateIds: null,
      phaseNumber: undefined,
      votedCount: undefined,
      aliveCount: undefined,
      mockParticipants: [
        { id: "m-w1", name: "Raka", isAlive: true, role: "Werewolf" },
        { id: "m-w2", name: "Dewi", isAlive: true, role: "Werewolf" },
        { id: "m-s1", name: "Sari", isAlive: true, role: "Seer" },
        { id: "m-v1", name: "Budi", isAlive: true, role: "Villager" },
        { id: "m-v2", name: "Citra", isAlive: true, role: "Villager" },
        { id: "m-v3", name: "Doni", isAlive: true, role: "Villager" },
        { id: "m-v4", name: "Eka", isAlive: true, role: "Villager" },
        { id: "m-v5", name: "Fajar", isAlive: true, role: "Villager" },
      ],
    },
  },
  {
    label: "Reset",
    patches: { status: undefined, myRole: undefined, isAlive: undefined, meId: undefined, meName: undefined, phaseEndsAtOffset: undefined, finishedReason: undefined, phaseNumber: undefined, lastEliminatedName: undefined, nightActionSubmitted: undefined, votedCount: undefined, aliveCount: undefined, myKillTargetId: undefined, mySeerCheckTargetId: undefined, myVoteTargetId: undefined, fellowWerewolves: undefined, mySeerChecks: undefined, revoteCandidateIds: undefined, participantOverrides: undefined, mockParticipants: undefined },
  },
];

export function applyDevPatches(rawState: Record<string, unknown> | null, patches: WerewolfDevPatches) {
  if (!rawState) return rawState;
  const s = { ...rawState } as Record<string, unknown>;

  if (patches.status !== undefined) s.status = patches.status;
  if (patches.myRole !== undefined) s.myRole = patches.myRole;
  if (patches.isJoined !== undefined) s.isJoined = patches.isJoined;
  if (patches.phaseNumber !== undefined) s.phaseNumber = patches.phaseNumber;
  if (patches.currentVoteRound !== undefined) s.currentVoteRound = patches.currentVoteRound;
  if (patches.finishedReason !== undefined) s.finishedReason = patches.finishedReason;
  if (patches.lastEliminatedName !== undefined) s.lastEliminatedName = patches.lastEliminatedName;
  if (patches.nightActionSubmitted !== undefined) s.nightActionSubmitted = patches.nightActionSubmitted;
  if (patches.votedCount !== undefined) s.votedCount = patches.votedCount;
  if (patches.aliveCount !== undefined) s.aliveCount = patches.aliveCount;
  if (patches.myKillTargetId !== undefined) s.myKillTargetId = patches.myKillTargetId;
  if (patches.mySeerCheckTargetId !== undefined) s.mySeerCheckTargetId = patches.mySeerCheckTargetId;
  if (patches.myVoteTargetId !== undefined) s.myVoteTargetId = patches.myVoteTargetId;
  if (patches.fellowWerewolves !== undefined) s.fellowWerewolves = patches.fellowWerewolves;
  if (patches.mySeerChecks !== undefined) s.mySeerChecks = patches.mySeerChecks;
  if (patches.revoteCandidateIds !== undefined) s.revoteCandidateIds = patches.revoteCandidateIds;

  if (patches.phaseEndsAt !== undefined) {
    s.phaseEndsAt = patches.phaseEndsAt;
  } else if (patches.phaseEndsAtOffset !== undefined) {
    s.phaseEndsAt = patches.phaseEndsAtOffset != null
      ? new Date(Date.now() + patches.phaseEndsAtOffset * 1000).toISOString()
      : null;
  }

  const me = s.me as Record<string, unknown> | null | undefined;
  if (me && (patches.isAlive !== undefined || patches.meName !== undefined || patches.meId !== undefined)) {
    s.me = {
      ...me,
      ...(patches.isAlive !== undefined ? { isAlive: patches.isAlive } : {}),
      ...(patches.meName !== undefined ? { name: patches.meName } : {}),
      ...(patches.meId !== undefined ? { id: patches.meId } : {}),
    };
  }

  if (patches.participantOverrides && Array.isArray(s.participants)) {
    s.participants = (s.participants as Record<string, unknown>[]).map((p) => {
      const override = patches.participantOverrides![p.id as string];
      if (!override) return p;
      const patched = { ...p };
      if (override.isAlive !== undefined) patched.isAlive = override.isAlive;
      if (override.voteCount !== undefined) patched.voteCount = override.voteCount;
      if (override.hasVoted !== undefined) patched.hasVoted = override.hasVoted;
      if (override.role !== undefined) patched.role = override.role;
      return patched;
    });
  }

  if (patches.mockParticipants && patches.mockParticipants.length > 0) {
    const mock = patches.mockParticipants.map((m) => ({
      id: m.id,
      name: m.name,
      isLeader: m.isLeader ?? false,
      isAlive: m.isAlive,
      role: m.role ?? null,
      voteCount: m.voteCount ?? 0,
      hasVoted: m.hasVoted ?? false,
      lastSeenAt: new Date().toISOString(),
    }));
    s.participants = [...(Array.isArray(s.participants) ? (s.participants as Record<string, unknown>[]) : []), ...mock];
    if (patches.aliveCount === undefined) s.aliveCount = ((s.participants as Record<string, unknown>[]).filter((p) => p.isAlive)).length;
  }

  if (s.status !== "Finished" && Array.isArray(s.participants)) {
    s.participants = (s.participants as Record<string, unknown>[]).map((p) => ({ ...p, role: null }));
  }

  return s;
}

export function shuffleRoles(playerCount: number): string[] {
  const werewolfCount = playerCount >= 8 ? 2 : 1;
  const roles: string[] = [
    ...Array(werewolfCount).fill("Werewolf"),
    "Seer",
    ...Array(playerCount - werewolfCount - 1).fill("Villager"),
  ];
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return roles;
}

export function materializeDevPatches(patches: WerewolfDevPatches): WerewolfDevPatches {
  if (patches.phaseEndsAtOffset === undefined) return patches;
  return {
    ...patches,
    phaseEndsAt: patches.phaseEndsAtOffset == null
      ? null
      : new Date(Date.now() + patches.phaseEndsAtOffset * 1000).toISOString(),
    phaseEndsAtOffset: undefined,
  };
}

export function WerewolfDevTools({
  rawState,
  patches,
  onPatch,
}: {
  rawState: Record<string, unknown> | null;
  patches: WerewolfDevPatches;
  onPatch: (p: WerewolfDevPatches) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"controls" | "state">("controls");
  const [mockName, setMockName] = useState("");
  const [mockRole, setMockRole] = useState("Villager");

  function commit(next: WerewolfDevPatches) {
    onPatch(materializeDevPatches(next));
  }

  function update(fields: WerewolfDevPatches) {
    commit({ ...patches, ...fields });
  }

  function clear() {
    onPatch({});
  }

  function addMock() {
    const name = mockName.trim();
    if (!name) return;
    const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const currentMocks = patches.mockParticipants ?? [];
    commit({
      ...patches,
      mockParticipants: [
        ...currentMocks,
        { id, name, isAlive: true, role: mockRole },
      ],
    });
    setMockName("");
  }

  function toggleMock(id: string) {
    const currentMocks = patches.mockParticipants ?? [];
    commit({
      ...patches,
      mockParticipants: currentMocks.map((m) =>
        m.id === id ? { ...m, isAlive: !m.isAlive } : m,
      ),
    });
  }

  function setMockRolePatch(id: string, role: string | null) {
    const currentMocks = patches.mockParticipants ?? [];
    commit({
      ...patches,
      mockParticipants: currentMocks.map((m) =>
        m.id === id ? { ...m, role } : m,
      ),
    });
  }

  function removeMock(id: string) {
    const currentMocks = patches.mockParticipants ?? [];
    const next = currentMocks.filter((m) => m.id !== id);
    commit({ ...patches, mockParticipants: next.length ? next : undefined });
  }

  function setPov(mock: { id: string; name: string; isAlive: boolean; role?: string | null }) {
    commit({
      ...patches,
      myRole: mock.role ?? null,
      isAlive: mock.isAlive,
      isJoined: true,
      meName: mock.name,
      meId: mock.id,
    });
  }

  function autoAssignAndStart() {
    const realPlayers = Array.isArray(rawState?.participants)
      ? (rawState!.participants as Array<{ id: string; name: string }>)
      : [];
    const mocks = patches.mockParticipants ?? [];
    const totalCount = realPlayers.length + mocks.length;
    if (totalCount < 4) return;

    const roles = shuffleRoles(totalCount);
    const overrides: Record<string, { role: string }> = {};

    for (const p of realPlayers) {
      overrides[p.id] = { role: roles.shift()! };
    }

    const assignedMocks = mocks.map((m) => ({
      ...m,
      role: roles.shift()!,
      isAlive: true,
    }));
    const currentMeId = patches.meId ?? (rawState?.me as { id?: string } | null)?.id ?? null;
    const currentRole = currentMeId
      ? overrides[currentMeId]?.role ?? assignedMocks.find((m) => m.id === currentMeId)?.role ?? null
      : patches.myRole ?? null;

    commit({
      ...patches,
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
      participantOverrides: { ...patches.participantOverrides, ...overrides },
      mockParticipants: assignedMocks,
    });
  }

  const participants = Array.isArray(rawState?.participants) ? (rawState!.participants as Record<string, unknown>[]) : [];
  const totalPlayerCount = participants.length + (patches.mockParticipants?.length ?? 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed right-4 bottom-4 z-50 flex h-8 items-center gap-1.5 rounded-full border border-primary/30 bg-background/90 px-3 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur transition-colors hover:border-primary/60 hover:text-primary"
      >
        <HugeiconsIcon icon={CodeFolderIcon} strokeWidth={2} className="size-3.5" />
        Dev
        {Object.keys(patches).length > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {Object.keys(patches).length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed right-4 bottom-14 z-50 flex max-h-[75dvh] w-80 flex-col rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Dev Tools</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clear}
                className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex border-b text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("controls")}
              className={`flex-1 py-2 text-center font-medium ${activeTab === "controls" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            >
              Controls
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("state")}
              className={`flex-1 py-2 text-center font-medium ${activeTab === "state" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            >
              State
            </button>
          </div>

          <div className="overflow-y-auto p-3 text-xs">
            {activeTab === "controls" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="font-semibold text-muted-foreground">Quick Presets</p>
                  <div className="grid grid-cols-2 gap-1">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => commit(preset.patches)}
                        className="rounded-md border border-border/50 bg-background px-2 py-1.5 text-left text-[11px] font-medium transition-colors hover:border-primary/40 hover:text-primary"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="font-semibold text-muted-foreground">Fase</p>
                  <select
                    value={(patches.status ?? rawState?.status ?? "Lobby") as string}
                    onChange={(e) => update({ status: e.target.value || undefined })}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
                  >
                    <option value="">(asli)</option>
                    {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <p className="font-semibold text-muted-foreground">Role kamu</p>
                  <select
                    value={(patches.myRole ?? rawState?.myRole ?? "") as string}
                    onChange={(e) => update({ myRole: e.target.value || null })}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
                  >
                    <option value="">(asli)</option>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <p className="font-semibold text-muted-foreground">Status diri</p>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={patches.isAlive ?? (rawState?.me as Record<string, unknown>)?.isAlive as boolean ?? true}
                      onChange={(e) => update({ isAlive: e.target.checked })}
                      className="size-3.5"
                    />
                    Hidup
                  </label>
                </div>

                <div className="space-y-1.5">
                  <p className="font-semibold text-muted-foreground">Timer (detik dari sekarang)</p>
                  <input
                    type="number"
                    placeholder="e.g. 45"
                    value={patches.phaseEndsAtOffset ?? ""}
                    onChange={(e) => update({ phaseEndsAtOffset: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
                  />
                  <button type="button" onClick={() => update({ phaseEndsAtOffset: null })} className="rounded text-[10px] text-muted-foreground underline">Hapus timer</button>
                </div>

                {participants.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-semibold text-muted-foreground">Pemain asli</p>
                    {participants.map((p) => {
                      const pid = p.id as string;
                      const name = p.name as string;
                      const override = patches.participantOverrides?.[pid] ?? {};
                      const isAlive = override.isAlive ?? (p.isAlive as boolean) ?? true;

                      return (
                        <div key={pid} className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
                          <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${isAlive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                            {isAlive ? "Hidup" : "Gugur"}
                          </span>
                          <button
                            type="button"
                            onClick={() => update({
                              participantOverrides: {
                                ...patches.participantOverrides,
                                [pid]: { ...override, isAlive: !isAlive },
                              },
                            })}
                            className="rounded px-1.5 py-0.5 text-[9px] text-muted-foreground hover:text-foreground"
                          >
                            Toggle
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-1.5">
                  <p className="font-semibold text-muted-foreground">Mock Pemain</p>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={mockName}
                      onChange={(e) => setMockName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addMock(); }}
                      placeholder="Nama..."
                      className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-xs"
                    />
                    <select
                      value={mockRole}
                      onChange={(e) => setMockRole(e.target.value)}
                      className="w-20 rounded-md border bg-background px-1 py-1.5 text-xs"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={addMock}
                      className="shrink-0 rounded-md border border-primary/40 px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                    >
                      + Tambah
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={autoAssignAndStart}
                    disabled={totalPlayerCount < 4}
                    className="w-full rounded-md border border-dashed border-sky-300/60 px-2 py-1.5 text-center text-xs font-semibold text-sky-600 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-sky-400 dark:hover:bg-sky-950/30"
                  >
                    Auto Assign Roles & Start (Night) — {totalPlayerCount} pemain{totalPlayerCount < 4 ? ` (butuh ${4 - totalPlayerCount} lagi)` : ""}
                  </button>
                  {(patches.mockParticipants ?? []).length > 0 && (
                    <div className="space-y-1">
                      {patches.mockParticipants!.map((m) => (
                        <div key={m.id} className="flex items-center gap-1.5 rounded-md border border-dashed border-amber-300/60 bg-amber-50/30 px-2 py-1.5 dark:bg-amber-950/20">
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">{m.name}</span>
                          <select
                            value={m.role ?? ""}
                            onChange={(e) => setMockRolePatch(m.id, e.target.value || null)}
                            className="w-18 rounded border bg-background px-1 py-0.5 text-[9px]"
                          >
                            <option value="">-</option>
                            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => toggleMock(m.id)}
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${m.isAlive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
                          >
                            {m.isAlive ? "Hidup" : "Gugur"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPov(m)}
                            title={`Lihat sebagai ${m.name}`}
                            className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold text-sky-600 hover:bg-sky-50"
                          >
                            POV
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMock(m.id)}
                            className="shrink-0 rounded px-1 py-0.5 text-[9px] text-muted-foreground hover:text-destructive"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "state" && (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {JSON.stringify(rawState, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </>
  );
}
