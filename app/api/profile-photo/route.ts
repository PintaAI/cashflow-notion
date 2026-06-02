import { get } from "@vercel/blob";
import { auth } from "@/lib/auth";
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

  const blobOptions = getBlobOptions();
  if (!blobOptions) {
    return new Response("Blob storage is not configured", { status: 500 });
  }

  const result = await get(pathname, {
    ...blobOptions,
    access: "private",
  });

  if (!result || result.statusCode === 304 || !result.stream) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", result.blob.contentType);
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("ETag", result.blob.etag);

  return new Response(result.stream, { headers });
}
