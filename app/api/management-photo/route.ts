import { auth } from "@/lib/auth";
import { getObject } from "@/lib/r2";
import { getBlobOptions } from "@/lib/blob";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pathname = searchParams.get("pathname");

  if (!pathname?.startsWith("managements/")) {
    return new Response("Invalid management photo", { status: 400 });
  }

  const [, managementId, fileName] = pathname.split("/");
  if (!managementId || !fileName || pathname.includes("..")) {
    return new Response("Invalid management photo", { status: 400 });
  }

  const membership = await prisma.managementMember.findFirst({
    where: { userId: session.user.id, managementId },
    select: { id: true },
  });
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
