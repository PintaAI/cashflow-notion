import { saveSubscription } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const subscription = await request.json();

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return Response.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const stored = await saveSubscription(subscription);

  return Response.json({ ok: true, endpoint: stored.endpoint });
}
