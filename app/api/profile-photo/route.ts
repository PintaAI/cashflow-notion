import { auth } from "@/lib/auth";
import { getObject } from "@/lib/r2";
import { getBlobOptions } from "@/lib/blob";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pathname = searchParams.get("pathname");

  if (!pathname?.startsWith("profiles/")) {
    return new Response("Invalid profile photo", { status: 400 });
  }

  const [, ownerUserId, fileName] = pathname.split("/");
  if (!ownerUserId || !fileName || pathname.includes("..")) {
    return new Response("Invalid profile photo", { status: 400 });
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
