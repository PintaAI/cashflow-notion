import crypto from "crypto";
import { extname } from "path";

import { auth } from "@/lib/auth";
import { getBlobOptions } from "@/lib/blob";
import { prisma } from "@/lib/db";
import { getObject, putObject } from "@/lib/r2";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

function getSafeFileName(fileName: string) {
  const extension = extname(fileName).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${crypto.randomUUID()}${extension}`;
}

async function getNoteMembership(noteId: string, userId: string) {
  return prisma.noteMember.findFirst({
    where: { noteId, userId },
    select: { id: true },
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const noteId = formData.get("noteId");
  const file = formData.get("file");

  if (typeof noteId !== "string" || !(file instanceof File)) {
    return Response.json({ message: "Invalid upload" }, { status: 400 });
  }

  const membership = await getNoteMembership(noteId, session.user.id);
  if (!membership) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  if (!getBlobOptions()) {
    return Response.json({ message: "R2 storage is not configured" }, { status: 500 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ message: "File is too large" }, { status: 413 });
  }

  const key = `notes/${noteId}/${getSafeFileName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await putObject(key, buffer, file.type || "application/octet-stream");

  const pathname = encodeURIComponent(key);
  return Response.json({ url: `/api/notes/files?pathname=${pathname}` });
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pathname = searchParams.get("pathname");

  if (!pathname?.startsWith("notes/") || pathname.includes("..")) {
    return new Response("Invalid note file", { status: 400 });
  }

  const [, noteId, fileName] = pathname.split("/");
  if (!noteId || !fileName) {
    return new Response("Invalid note file", { status: 400 });
  }

  const membership = await getNoteMembership(noteId, session.user.id);
  if (!membership) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!getBlobOptions()) {
    return new Response("R2 storage is not configured", { status: 500 });
  }

  const result = await getObject(pathname);
  if (!result) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", result.contentType);
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("ETag", result.etag);

  return new Response(result.stream, { headers });
}
