export type StatieRealtimeEvent = {
  type: "statie.room.changed";
  code: string;
  action: string;
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
