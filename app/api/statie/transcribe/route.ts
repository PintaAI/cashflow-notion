import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { StatieRoundStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

const DEFAULT_MAX_UPLOAD_MB = 25;
const DEFAULT_LANGUAGE = "id";

function getMaxUploadBytes() {
  const configured = Number(process.env.STT_MAX_UPLOAD_MB ?? DEFAULT_MAX_UPLOAD_MB);
  const maxUploadMb = Number.isFinite(configured) ? configured : DEFAULT_MAX_UPLOAD_MB;
  return Math.max(1, maxUploadMb) * 1024 * 1024;
}

function normalizeRoomCode(code: string) {
  return code.trim().replace(/[^a-z0-9]/gi, "").toUpperCase();
}

async function requireStatieParticipant(code: string, roundId: string) {
  const roomCode = normalizeRoomCode(code);
  if (!roomCode || !roundId) return null;

  const store = await cookies();
  const token = store.get(`statie-room-${roomCode.toLowerCase()}`)?.value;
  if (!token) return null;

  return prisma.statieParticipant.findFirst({
    where: {
      token,
      room: {
        code: roomCode,
        rounds: { some: { id: roundId, status: { in: [StatieRoundStatus.Debate, StatieRoundStatus.Finished] } } },
      },
    },
    select: { id: true },
  });
}

export async function POST(request: NextRequest) {
  const whisperBaseUrl = process.env.WHISPER_BASE_URL;
  const whisperApiKey = process.env.WHISPER_API_KEY;

  if (!whisperBaseUrl || !whisperApiKey) {
    return NextResponse.json({ success: false, error: "Whisper service is not configured." }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const code = String(formData.get("code") || "");
    const roundId = String(formData.get("roundId") || "");

    const participant = await requireStatieParticipant(code, roundId);
    if (!participant) {
      return NextResponse.json({ success: false, error: "Unauthorized Statie participant." }, { status: 401 });
    }

    if (!(audio instanceof File)) {
      return NextResponse.json({ success: false, error: "Audio file is required." }, { status: 400 });
    }

    if (audio.size > getMaxUploadBytes()) {
      return NextResponse.json({ success: false, error: "Audio file is too large." }, { status: 413 });
    }

    const upstreamForm = new FormData();
    upstreamForm.set("file", audio, audio.name || "statie-audio.webm");
    upstreamForm.set("language", String(formData.get("language") || process.env.STT_LANGUAGE || DEFAULT_LANGUAGE));

    const prompt = formData.get("prompt");
    if (typeof prompt === "string" && prompt.trim()) {
      upstreamForm.set("prompt", prompt.trim().slice(0, 500));
    }

    const response = await fetch(`${whisperBaseUrl.replace(/\/$/, "")}/v1/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${whisperApiKey}` },
      body: upstreamForm,
      signal: AbortSignal.timeout(120_000),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: payload?.detail || payload?.error || "Transcription failed." },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, text: payload?.text ?? "", language: payload?.language ?? null });
  } catch (error) {
    console.error("Statie transcribe error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Transcription failed." },
      { status: 500 }
    );
  }
}
