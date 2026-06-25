import type * as Party from "partykit/server";
import { isStatieRealtimeEvent } from "../lib/realtime/statie-realtime-types";

const STATIE_ROOM_PREFIX = "statie-";

export default class StatieRealtimeRoom implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onRequest() {
    return Response.json({ ok: true, room: this.room.id });
  }

  onMessage(message: string, sender: Party.Connection) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }

    if (!isStatieRealtimeEvent(parsed)) return;
    if (this.room.id !== `${STATIE_ROOM_PREFIX}${parsed.code.toLowerCase()}`) return;

    this.room.broadcast(JSON.stringify(parsed), [sender.id]);
  }
}
