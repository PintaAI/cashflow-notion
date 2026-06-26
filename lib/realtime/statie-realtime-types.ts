export type StatieRealtimeEvent = {
  type: "statie.room.changed";
  code: string;
  action: string;
  at: number;
};

export type StatieVoteRealtimeEvent = {
  type: "statie.vote.changed";
  code: string;
  roundId: string;
  participantId: string;
  participantName: string;
  choice: "Agree" | "Disagree";
  at: number;
};

export type StatieLiveSnapshotEvent = {
  type: "statie.live.snapshot";
  code: string;
  room: unknown;
  at: number;
};

export function isStatieRealtimeEvent(value: unknown): value is StatieRealtimeEvent {
  const event = value as Partial<StatieRealtimeEvent>;
  return Boolean(
    event
      && event.type === "statie.room.changed"
      && typeof event.code === "string"
      && typeof event.action === "string"
      && typeof event.at === "number",
  );
}

export function parseStatieRealtimeEvent(data: string): StatieRealtimeEvent | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    return isStatieRealtimeEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isStatieVoteRealtimeEvent(value: unknown): value is StatieVoteRealtimeEvent {
  const event = value as Partial<StatieVoteRealtimeEvent>;
  return Boolean(
    event
      && event.type === "statie.vote.changed"
      && typeof event.code === "string"
      && typeof event.roundId === "string"
      && typeof event.participantId === "string"
      && typeof event.participantName === "string"
      && (event.choice === "Agree" || event.choice === "Disagree")
      && typeof event.at === "number",
  );
}

export function isStatieLiveSnapshotEvent(value: unknown): value is StatieLiveSnapshotEvent {
  const event = value as Partial<StatieLiveSnapshotEvent>;
  return Boolean(
    event
      && event.type === "statie.live.snapshot"
      && typeof event.code === "string"
      && typeof event.room === "object"
      && typeof event.at === "number",
  );
}
