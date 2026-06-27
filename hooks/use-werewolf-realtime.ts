"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { WerewolfGameState } from "@/lib/werewolf/game-state";
import { isWerewolfGameStateEvent, isWerewolfRealtimeEvent, type WerewolfGameStateEvent, type WerewolfRealtimeEvent } from "@/lib/realtime/werewolf-realtime-types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type WerewolfRealtimeStatus = "disabled" | "connecting" | "connected" | "error";

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  supabaseClient ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return supabaseClient;
}

export function useWerewolfRealtime(
  code: string,
  onRoomChanged: (event: WerewolfRealtimeEvent) => void | Promise<void>,
  onGameState?: (event: WerewolfGameStateEvent) => void | Promise<void>,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onRoomChangedRef = useRef(onRoomChanged);
  const onGameStateRef = useRef(onGameState);
  const [status, setStatus] = useState<WerewolfRealtimeStatus>(SUPABASE_URL && SUPABASE_ANON_KEY ? "connecting" : "disabled");

  useEffect(() => {
    onRoomChangedRef.current = onRoomChanged;
  }, [onRoomChanged]);

  useEffect(() => {
    onGameStateRef.current = onGameState;
  }, [onGameState]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      queueMicrotask(() => setStatus("disabled"));
      return;
    }

    let active = true;
    const roomCode = code.toUpperCase();
    const channel = supabase.channel(`werewolf:${roomCode.toLowerCase()}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    queueMicrotask(() => {
      if (active) setStatus("connecting");
    });

    channel
      .on("broadcast", { event: "room_changed" }, ({ payload }) => {
        if (!active || !isWerewolfRealtimeEvent(payload) || payload.code !== roomCode) return;
        void onRoomChangedRef.current(payload);
      })
      .on("broadcast", { event: "game_state" }, ({ payload }) => {
        if (!active || !isWerewolfGameStateEvent(payload) || payload.code !== roomCode) return;
        void onGameStateRef.current?.(payload);
      })
      .subscribe((nextStatus) => {
        if (!active) return;
        if (nextStatus === "SUBSCRIBED") setStatus("connected");
        if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT") setStatus("error");
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [code]);

  function publish(action: string) {
    const channel = channelRef.current;
    const roomCode = code.toUpperCase();
    if (!channel) return;
    void channel.send({
      type: "broadcast",
      event: "room_changed",
      payload: { type: "werewolf.room.changed", code: roomCode, action, at: Date.now() } satisfies WerewolfRealtimeEvent,
    });
  }

  function publishGameState(game: WerewolfGameState | null) {
    const channel = channelRef.current;
    const roomCode = code.toUpperCase();
    if (!channel) return;
    void channel.send({
      type: "broadcast",
      event: "game_state",
      payload: { type: "werewolf.game.state", code: roomCode, game, at: Date.now() } satisfies WerewolfGameStateEvent,
    });
  }

  return { status, publish, publishGameState, enabled: status === "connected" };
}
