import { prisma } from "@/lib/db";
import { reconcileBilling } from "@/lib/billing";

const MAX_EVENT_ID_LENGTH = 256;

export async function processWebhookEvent(rawBody: string, signatureTimestamp: bigint | null): Promise<Response> {
  const event = JSON.parse(rawBody);
  const eventId: string | undefined = event?.event?.id;

  if (!eventId || eventId.length > MAX_EVENT_ID_LENGTH) {
    return Response.json({ error: "invalid event id" }, { status: 400 });
  }
  const expectedAppId = process.env.REVENUECAT_APP_ID_IOS;
  const eventAppId = event?.event?.app_id;
  if (expectedAppId && eventAppId && eventAppId !== expectedAppId) {
    return Response.json({ error: "unexpected RevenueCat app" }, { status: 400 });
  }

  const existing = await prisma.revenueCatWebhookEvent.findUnique({
    where: { eventId },
    select: { status: true },
  });

  if (existing?.status === "processed") {
    return Response.json({ received: true });
  }

  if (existing) {
    await prisma.revenueCatWebhookEvent.update({
      where: { eventId },
      data: { attempts: { increment: 1 } },
    });
  } else {
    await prisma.revenueCatWebhookEvent.create({
      data: {
        eventId,
        apiVersion: event?.api_version ?? null,
        eventType: event?.event?.type ?? "unknown",
        appId: event?.event?.app_id ?? null,
        environment: event?.event?.environment ?? null,
        appUserId: event?.event?.app_user_id ?? null,
        originalAppUserId: event?.event?.original_app_user_id ?? null,
        aliases: event?.event?.aliases ?? null,
        rawPayload: event,
        signatureTimestamp,
        status: "pending",
      },
    });
  }

  try {
    const eventData = event?.event ?? {};
    const identities = new Set<string>();
    for (const value of [
      eventData.app_user_id,
      eventData.original_app_user_id,
      ...(Array.isArray(eventData.aliases) ? eventData.aliases : []),
      ...(Array.isArray(eventData.transferred_from) ? eventData.transferred_from : []),
      ...(Array.isArray(eventData.transferred_to) ? eventData.transferred_to : []),
    ]) {
      if (typeof value === "string" && value) identities.add(value);
    }

    const users = await prisma.user.findMany({
      where: { revenueCatAppUserId: { in: [...identities] } },
      select: { id: true },
    });
    for (const user of users) {
      await reconcileBilling(user.id);
    }

    await prisma.revenueCatWebhookEvent.update({
      where: { eventId },
      data: { status: "processed", processedAt: new Date(), lastError: null },
    });
  } catch (error) {
    await prisma.revenueCatWebhookEvent.update({
      where: { eventId },
      data: {
        status: "failed",
        lastError: error instanceof Error ? error.message : "Unknown error",
        attempts: { increment: 1 },
      },
    });
    return Response.json({ error: "processing failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
