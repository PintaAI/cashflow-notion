import { removeSubscription } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();

  if (!body?.endpoint || typeof body.endpoint !== "string") {
    return Response.json({ error: "Missing subscription endpoint" }, { status: 400 });
  }

  const removed = await removeSubscription(body.endpoint);

  return Response.json({ ok: true, removed });
}
