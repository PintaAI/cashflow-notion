"use client";

import { useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import { parseStatieRealtimeEvent, type StatieRealtimeEvent } from "@/lib/realtime/statie-realtime-types";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST;

type StatieRealtimeStatus = "disabled" | "connecting" | "connected" | "disconnected" | "error";

export function useStatieRealtime(code: string, onRoomChanged: (event: StatieRealtimeEvent) => void | Promise<void>) {
  const socketRef = useRef<PartySocket | null>(null);
  const onRoomChangedRef = useRef(onRoomChanged);
  const [status, setStatus] = useState<StatieRealtimeStatus>(PARTYKIT_HOST ? "connecting" : "disabled");

  useEffect(() => {
    onRoomChangedRef.current = onRoomChanged;
  }, [onRoomChanged]);

  useEffect(() => {
    if (!PARTYKIT_HOST) {
      queueMicrotask(() => setStatus("disabled"));
      return;
    }

    let active = true;
    const socket = new PartySocket({ host: PARTYKIT_HOST, room: `statie-${code.toLowerCase()}` });
    socketRef.current = socket;

    queueMicrotask(() => {
      if (active) setStatus("connecting");
    });

    socket.addEventListener("open", () => setStatus("connected"));
    socket.addEventListener("close", () => setStatus("disconnected"));
    socket.addEventListener("error", () => setStatus("error"));
    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const message = parseStatieRealtimeEvent(event.data);
      if (!message || message.code !== code) return;
      void onRoomChangedRef.current(message);
    });

    return () => {
      active = false;
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [code]);

  function publish(action: string) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "statie.room.changed", code, action, at: Date.now() } satisfies StatieRealtimeEvent));
  }

  return { status, publish, enabled: Boolean(PARTYKIT_HOST) };
}
