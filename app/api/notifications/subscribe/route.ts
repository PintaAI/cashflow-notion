import { auth } from "@/lib/auth";
import { saveSubscription, readSubscriptions, writeSubscriptions } from "@/lib/notifications";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const subscription = await request.json();

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return Response.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  const stored = await saveSubscription(subscription);

  if (session) {
    const membership = await prisma.managementMember.findFirst({
      where: { userId: session.user.id },
    });
    if (membership) {
      stored.userId = session.user.id;
      stored.managementId = membership.managementId;
      stored.updatedAt = new Date().toISOString();
      const all = await readSubscriptions();
      const idx = all.findIndex((s) => s.endpoint === stored.endpoint);
      if (idx !== -1) {
        all[idx] = stored;
        await writeSubscriptions(all);
      }
    }
  }

  return Response.json({ ok: true, endpoint: stored.endpoint });
}
