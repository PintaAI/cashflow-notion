"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { isStatieLiveSnapshotEvent, isStatieRealtimeEvent, isStatieVoteRealtimeEvent, type StatieLiveSnapshotEvent, type StatieRealtimeEvent, type StatieVoteRealtimeEvent } from "@/lib/realtime/statie-realtime-types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type StatieRealtimeStatus = "disabled" | "connecting" | "connected" | "error";

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  supabaseClient ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return supabaseClient;
}

type StatementDraftHandler = (text: string) => void;
type VoteHandler = (event: StatieVoteRealtimeEvent) => void;
type LiveSnapshotHandler = (event: StatieLiveSnapshotEvent) => void;

export function useStatieRealtime(
  code: string,
  onRoomChanged: (event: StatieRealtimeEvent) => void | Promise<void>,
  onStatementDraft?: StatementDraftHandler,
  onVote?: VoteHandler,
  onLiveSnapshot?: LiveSnapshotHandler,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onRoomChangedRef = useRef(onRoomChanged);
  const onStatementDraftRef = useRef(onStatementDraft);
  const onVoteRef = useRef(onVote);
  const onLiveSnapshotRef = useRef(onLiveSnapshot);
  const [status, setStatus] = useState<StatieRealtimeStatus>(SUPABASE_URL && SUPABASE_ANON_KEY ? "connecting" : "disabled");

  useEffect(() => {
    onRoomChangedRef.current = onRoomChanged;
  }, [onRoomChanged]);

  useEffect(() => {
    onStatementDraftRef.current = onStatementDraft;
  }, [onStatementDraft]);

  useEffect(() => {
    onVoteRef.current = onVote;
  }, [onVote]);

  useEffect(() => {
    onLiveSnapshotRef.current = onLiveSnapshot;
  }, [onLiveSnapshot]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      queueMicrotask(() => setStatus("disabled"));
      return;
    }

    let active = true;
    const channel = supabase.channel(`statie:${code.toLowerCase()}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    queueMicrotask(() => {
      if (active) setStatus("connecting");
    });

    channel
      .on("broadcast", { event: "room_changed" }, ({ payload }) => {
        if (!isStatieRealtimeEvent(payload) || payload.code !== code) return;
        void onRoomChangedRef.current(payload);
      })
      .on("broadcast", { event: "statement_draft" }, ({ payload }) => {
        if (!active || typeof payload?.text !== "string" || payload.code !== code) return;
        onStatementDraftRef.current?.(payload.text);
      })
      .on("broadcast", { event: "vote_changed" }, ({ payload }) => {
        if (!active || !isStatieVoteRealtimeEvent(payload) || payload.code !== code) return;
        onVoteRef.current?.(payload);
      })
      .on("broadcast", { event: "live_snapshot" }, ({ payload }) => {
        if (!active || !isStatieLiveSnapshotEvent(payload) || payload.code !== code) return;
        onLiveSnapshotRef.current?.(payload);
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
    if (!channel) return;
    void channel.send({
      type: "broadcast",
      event: "room_changed",
      payload: { type: "statie.room.changed", code, action, at: Date.now() } satisfies StatieRealtimeEvent,
    });
  }

  function publishDraft(text: string) {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({
      type: "broadcast",
      event: "statement_draft",
      payload: { code, text },
    });
  }

  function publishVote(vote: Omit<StatieVoteRealtimeEvent, "type" | "code" | "at">) {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({
      type: "broadcast",
      event: "vote_changed",
      payload: { type: "statie.vote.changed", code, ...vote, at: Date.now() } satisfies StatieVoteRealtimeEvent,
    });
  }

  function publishLiveSnapshot(room: unknown) {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({
      type: "broadcast",
      event: "live_snapshot",
      payload: { type: "statie.live.snapshot", code, room, at: Date.now() } satisfies StatieLiveSnapshotEvent,
    });
  }

  return { status, publish, publishDraft, publishVote, publishLiveSnapshot, enabled: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) };
}
