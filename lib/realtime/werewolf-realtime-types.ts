import type { WerewolfGameState } from "@/lib/werewolf/game-state";

export type WerewolfRealtimeEvent = {
  type: "werewolf.room.changed";
  code: string;
  action: string;
  at: number;
};

export type WerewolfGameStateEvent = {
  type: "werewolf.game.state";
  code: string;
  game: WerewolfGameState | null;
  at: number;
};

export function isWerewolfRealtimeEvent(value: unknown): value is WerewolfRealtimeEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    event.type === "werewolf.room.changed" &&
    typeof event.code === "string" &&
    typeof event.action === "string" &&
    typeof event.at === "number"
  );
}

export function isWerewolfGameStateEvent(value: unknown): value is WerewolfGameStateEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return event.type === "werewolf.game.state" && typeof event.code === "string" && typeof event.at === "number";
}
