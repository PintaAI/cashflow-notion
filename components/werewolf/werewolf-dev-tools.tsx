"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CodeFolderIcon } from "@hugeicons/core-free-icons";
import type { WerewolfGameState, WerewolfRoleName } from "@/lib/werewolf/game-state";
import { WerewolfRoleCard } from "./werewolf-card";

type DevParticipant = {
  id: string;
  name: string;
  isAlive: boolean;
  isLeader?: boolean;
  isModerator?: boolean;
  role?: WerewolfRoleName | null;
  voteCount?: number;
  hasVoted?: boolean;
};

export interface WerewolfDevPatches {
  isJoined?: boolean;
  meId?: string | null;
  meName?: string | null;
  participantOverrides?: Record<string, { role?: WerewolfRoleName | null }>;
  mockParticipants?: DevParticipant[];
}

const ROLES: Array<WerewolfRoleName | ""> = ["", "Werewolf", "Seer", "Villager"];
const MOCK_PRESETS = [
  {
    label: "4P basic",
    players: [
      ["Raka", "Werewolf"],
      ["Sari", "Seer"],
      ["Budi", "Villager"],
      ["Citra", "Villager"],
    ],
  },
  {
    label: "8P full",
    players: [
      ["Raka", "Werewolf"],
      ["Dewi", "Werewolf"],
      ["Sari", "Seer"],
      ["Budi", "Villager"],
      ["Citra", "Villager"],
      ["Doni", "Villager"],
      ["Eka", "Villager"],
      ["Fajar", "Villager"],
    ],
  },
] satisfies Array<{ label: string; players: Array<[string, WerewolfRoleName]> }>;

function uniqueParticipants(participants: DevParticipant[]) {
  return participants.filter((participant, index, items) => items.findIndex((item) => item.id === participant.id) === index);
}

function gameParticipantsForMeta(gameState: WerewolfGameState | null | undefined): DevParticipant[] {
  return (gameState?.participants ?? []).map((participant) => ({
    id: participant.id,
    name: participant.name,
    isLeader: participant.isLeader,
    isModerator: participant.isModerator,
    isAlive: participant.isAlive,
    role: participant.role,
    voteCount: 0,
    hasVoted: false,
  }));
}

export function applyDevRoomPatches(rawState: Record<string, unknown> | null, patches: WerewolfDevPatches, gameState?: WerewolfGameState | null) {
  if (!rawState) return rawState;

  const next = { ...rawState } as Record<string, unknown>;
  const realParticipants = Array.isArray(next.participants) ? (next.participants as DevParticipant[]) : [];
  const moderatorParticipants = realParticipants.filter((participant) => participant.isModerator);
  const mockParticipants = (patches.mockParticipants ?? []).map((participant) => ({
    ...participant,
    isLeader: participant.isLeader ?? false,
    isModerator: participant.isModerator ?? false,
    isAlive: participant.isAlive,
    voteCount: participant.voteCount ?? 0,
    hasVoted: participant.hasVoted ?? false,
    lastSeenAt: new Date().toISOString(),
  }));

  const participants = gameState
    ? uniqueParticipants([...moderatorParticipants, ...gameParticipantsForMeta(gameState)])
    : uniqueParticipants([...realParticipants, ...mockParticipants]);

  next.participants = participants;
  if (patches.isJoined !== undefined) next.isJoined = patches.isJoined;

  const povParticipant = patches.meId ? participants.find((participant) => participant.id === patches.meId) : null;
  if (povParticipant || patches.meId !== undefined || patches.meName !== undefined || patches.isJoined !== undefined) {
    next.isJoined = patches.isJoined ?? next.isJoined;
    next.me = {
      ...((next.me as Record<string, unknown> | null) ?? {}),
      ...(patches.meId !== undefined ? { id: patches.meId } : null),
      ...(patches.meName !== undefined || povParticipant ? { name: patches.meName ?? povParticipant?.name } : null),
      ...(povParticipant ? { isAlive: povParticipant.isAlive, isModerator: Boolean(povParticipant.isModerator) } : null),
    };
  }

  return next;
}

export function WerewolfDevTools({ rawState, actualRoles, patches, onPatch, timerFrozen, onToggleTimerFreeze, onNextPhase }: {
  rawState: Record<string, unknown> | null;
  actualRoles?: Record<string, string | null>;
  patches: WerewolfDevPatches;
  onPatch: (patches: WerewolfDevPatches) => void;
  timerFrozen?: boolean;
  onToggleTimerFreeze?: () => void;
  onNextPhase?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mockName, setMockName] = useState("");
  const [mockRole, setMockRole] = useState<WerewolfRoleName>("Villager");

  function update(next: WerewolfDevPatches) {
    onPatch({ ...patches, ...next });
  }

  function addMockPlayer() {
    const name = mockName.trim();
    if (!name) return;
    update({
      mockParticipants: [
        ...(patches.mockParticipants ?? []),
        { id: `mock-${Date.now().toString(36)}`, name, role: mockRole, isAlive: true },
      ],
      isJoined: true,
    });
    setMockName("");
  }

  function applyMockPreset(players: Array<[string, WerewolfRoleName]>) {
    update({
      mockParticipants: players.map(([name, role], index) => ({
        id: `mock-${name.toLowerCase()}-${index}`,
        name,
        role,
        isAlive: true,
      })),
      isJoined: true,
    });
  }

  function setPov(participant: { id: string; name: string }) {
    update({ isJoined: true, meId: participant.id, meName: participant.name });
  }

  function updateMock(id: string, patch: Partial<DevParticipant>) {
    update({
      mockParticipants: (patches.mockParticipants ?? []).map((participant) =>
        participant.id === id ? { ...participant, ...patch } : participant,
      ),
    });
  }

  function removeMock(id: string) {
    const nextMocks = (patches.mockParticipants ?? []).filter((participant) => participant.id !== id);
    update({ mockParticipants: nextMocks.length ? nextMocks : undefined });
  }

  const participants = Array.isArray(rawState?.participants)
    ? (rawState.participants as DevParticipant[]).filter((participant, index, items) => items.findIndex((item) => item.id === participant.id) === index)
    : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed right-4 bottom-4 z-50 flex h-8 items-center gap-1.5 rounded-full border border-primary/30 bg-background/90 px-3 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur transition-colors hover:border-primary/60 hover:text-primary"
      >
        <HugeiconsIcon icon={CodeFolderIcon} strokeWidth={2} className="size-3.5" />
        Dev
        {Object.keys(patches).length > 0 && <span className="rounded-full bg-primary px-1.5 text-[9px] text-primary-foreground">on</span>}
      </button>

      {open && (
        <div className="fixed right-4 bottom-14 z-50 w-80 space-y-3 rounded-lg border bg-card p-3 text-xs shadow-lg">
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-[0.15em] text-muted-foreground">Werewolf Dev</span>
            <button type="button" onClick={() => onPatch({})} className="text-muted-foreground hover:text-foreground">Clear</button>
          </div>

          <p className="rounded-md bg-muted/60 p-2 text-[11px] text-muted-foreground">
            Dev tools only create mock players and switch POV. All actions and phase changes use the real game engine.
          </p>

          {(onToggleTimerFreeze || onNextPhase) && (
            <div className="grid grid-cols-2 gap-1">
              {onToggleTimerFreeze && (
                <button
                  type="button"
                  onClick={onToggleTimerFreeze}
                  className="rounded-md border border-primary/40 bg-background px-2 py-1.5 text-left text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  {timerFrozen ? "Resume timer" : "Freeze timer"}
                </button>
              )}
              {onNextPhase && (
                <button
                  type="button"
                  onClick={onNextPhase}
                  className="rounded-md border border-primary/40 bg-primary px-2 py-1.5 text-left text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Next phase
                </button>
              )}
            </div>
          )}

          <div className="space-y-2 rounded-md border bg-muted/30 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-muted-foreground">Mock players / POV</span>
              {patches.meId && <span className="text-[10px] text-primary">POV active</span>}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {MOCK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyMockPreset(preset.players)}
                  className="rounded-md border bg-background px-2 py-1.5 text-left text-[11px] font-semibold transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                value={mockName}
                onChange={(event) => setMockName(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") addMockPlayer(); }}
                placeholder="Nama mock"
                className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5"
              />
              <select value={mockRole} onChange={(event) => setMockRole(event.target.value as WerewolfRoleName)} className="w-24 rounded-md border bg-background px-1 py-1.5">
                {ROLES.filter(Boolean).map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <button type="button" onClick={addMockPlayer} className="rounded-md border border-primary/40 px-2 font-semibold text-primary">+</button>
            </div>
            <div className="max-h-48 space-y-1 overflow-auto">
              {participants.map((participant) => {
                const isMock = participant.id.startsWith("mock-");
                const actualRole = actualRoles?.[participant.id] ?? participant.role ?? null;
                return (
                  <div
                    key={participant.id}
                    className={`flex w-full items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-left transition-colors hover:border-primary/40 ${patches.meId === participant.id ? "border-primary/50 text-primary" : ""}`}
                  >
                    <button type="button" onClick={() => setPov(participant)} className="min-w-0 flex-1 truncate text-left font-medium">
                      {participant.name}
                    </button>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{actualRole || "unknown"}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${participant.isAlive === false ? "bg-muted text-muted-foreground" : "bg-emerald-500/10 text-emerald-600"}`}>{participant.isAlive === false ? "dead" : "alive"}</span>
                    {isMock && !actualRoles?.[participant.id] && (
                      <button
                        type="button"
                        onClick={() => updateMock(participant.id, { isAlive: !participant.isAlive })}
                        className="rounded px-1 text-[9px] text-muted-foreground hover:text-foreground"
                      >
                        toggle
                      </button>
                    )}
                    {isMock && !actualRoles?.[participant.id] && (
                      <button
                        type="button"
                        onClick={() => removeMock(participant.id)}
                        className="rounded px-1 text-[9px] text-muted-foreground hover:text-destructive"
                      >
                        x
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 rounded-md border bg-muted/30 p-2">
            <span className="font-medium text-muted-foreground">Role Card Preview</span>
            <div className="flex gap-1">
              {(["Werewolf", "Seer", "Villager"] as const).map((role) => (
                <WerewolfRoleCard key={role} role={role}>
                  <button
                    type="button"
                    className="flex-1 rounded-md border bg-background px-2 py-1.5 text-center text-[11px] font-semibold transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {role}
                  </button>
                </WerewolfRoleCard>
              ))}
            </div>
          </div>

          <details>
            <summary className="cursor-pointer text-muted-foreground">Room snapshot</summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {JSON.stringify(rawState, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </>
  );
}
