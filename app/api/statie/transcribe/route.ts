import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { StatieRoundStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

const DEFAULT_MAX_UPLOAD_MB = 25;
const DEFAULT_LANGUAGE = "id";
const DEFAULT_GROQ_MODEL = "whisper-large-v3-turbo";

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
        rounds: { some: { id: roundId, status: { in: [StatieRoundStatus.Debate, StatieRoundStatus.CollectingTranscripts, StatieRoundStatus.Finished] } } },
      },
    },
    select: { id: true },
  });
}

function getPrompt(formData: FormData) {
  const prompt = formData.get("prompt");
  return typeof prompt === "string" && prompt.trim() ? prompt.trim().slice(0, 500) : "";
}

function getLanguage(formData: FormData) {
  return String(formData.get("language") || process.env.STT_LANGUAGE || DEFAULT_LANGUAGE);
}

async function transcribeWithGroq(audio: File, formData: FormData) {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) throw new Error("Groq STT is not configured.");

  const upstreamForm = new FormData();
  upstreamForm.set("file", audio, audio.name || "statie-audio.webm");
  upstreamForm.set("model", process.env.GROQ_STT_MODEL || DEFAULT_GROQ_MODEL);
  upstreamForm.set("language", getLanguage(formData));
  upstreamForm.set("response_format", "json");
  upstreamForm.set("temperature", "0");

  const prompt = getPrompt(formData);
  if (prompt) upstreamForm.set("prompt", prompt.slice(0, 224));

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqApiKey}` },
    body: upstreamForm,
    signal: AbortSignal.timeout(120_000),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = payload?.error?.message || payload?.detail || payload?.error || "Groq transcription failed.";
    const error = new Error(errorMessage);
    error.name = `GroqSTT:${response.status}`;
    throw error;
  }

  return { text: payload?.text ?? "", language: payload?.language ?? getLanguage(formData), provider: "groq" };
}

async function transcribeWithSelfHostedWhisper(audio: File, formData: FormData) {
  const whisperBaseUrl = process.env.WHISPER_BASE_URL;
  const whisperApiKey = process.env.WHISPER_API_KEY;
  if (!whisperBaseUrl || !whisperApiKey) throw new Error("Self-hosted Whisper service is not configured.");

  const upstreamForm = new FormData();
  upstreamForm.set("file", audio, audio.name || "statie-audio.webm");
  upstreamForm.set("language", getLanguage(formData));

  const prompt = getPrompt(formData);
  if (prompt) upstreamForm.set("prompt", prompt);

  const response = await fetch(`${whisperBaseUrl.replace(/\/$/, "")}/v1/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${whisperApiKey}` },
    body: upstreamForm,
    signal: AbortSignal.timeout(120_000),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = payload?.detail || payload?.error || "Self-hosted Whisper transcription failed.";
    const error = new Error(errorMessage);
    error.name = `WhisperSTT:${response.status}`;
    throw error;
  }

  return { text: payload?.text ?? "", language: payload?.language ?? null, provider: "self-hosted-whisper" };
}

export async function POST(request: NextRequest) {
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasSelfHostedWhisper = Boolean(process.env.WHISPER_BASE_URL && process.env.WHISPER_API_KEY);
  if (!hasGroq && !hasSelfHostedWhisper) {
    return NextResponse.json({ success: false, error: "Speech-to-text service is not configured." }, { status: 503 });
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

    let groqError: Error | null = null;
    if (hasGroq) {
      try {
        const result = await transcribeWithGroq(audio, formData);
        return NextResponse.json({ success: true, ...result });
      } catch (error) {
        groqError = error instanceof Error ? error : new Error("Groq transcription failed.");
        console.warn("Groq transcription failed, falling back when possible:", groqError.message);
      }
    }

    if (hasSelfHostedWhisper) {
      const result = await transcribeWithSelfHostedWhisper(audio, formData);
      return NextResponse.json({ success: true, ...result, fallbackFrom: groqError ? "groq" : null });
    }

    return NextResponse.json({ success: false, error: groqError?.message || "Transcription failed." }, { status: 502 });
  } catch (error) {
    console.error("Statie transcribe error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Transcription failed." },
      { status: 500 }
    );
  }
}
