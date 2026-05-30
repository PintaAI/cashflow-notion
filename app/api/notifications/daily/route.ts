import { prisma } from "@/lib/db";
import { readSubscriptions, writeSubscriptions, type StoredPushSubscription } from "@/lib/notifications";
import webPush from "web-push";

export const runtime = "nodejs";

const TIMEZONE = process.env.NOTIFICATION_TIMEZONE || "Asia/Jakarta";

function getDateInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to format date for timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  return Boolean(secret && authorization === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) {
      return Response.json({ error: "Missing VAPID configuration" }, { status: 500 });
    }
    webPush.setVapidDetails(subject, publicKey, privateKey);

    const today = getDateInTimezone(new Date(), TIMEZONE);
    const allSubscriptions = await readSubscriptions();

    const byManagement = new Map<string, StoredPushSubscription[]>();
    const orphaned: StoredPushSubscription[] = [];

    for (const sub of allSubscriptions) {
      if (sub.managementId) {
        const list = byManagement.get(sub.managementId) || [];
        list.push(sub);
        byManagement.set(sub.managementId, list);
      } else {
        orphaned.push(sub);
      }
    }

    const payload = JSON.stringify({
      title: "Cashflow reminder",
      body: "No cashflow entry yet today. Add one before you forget.",
      url: "/?action=add",
    });

    let sent = 0;
    let attempted = 0;
    const invalidEndpoints = new Set<string>();

    for (const [managementId, subs] of byManagement) {
      const hasEntries = await prisma.entry.findFirst({ where: { date: today, managementId } });
      if (hasEntries) continue;

      for (const subscription of subs) {
        attempted++;
        try {
          await webPush.sendNotification(subscription, payload);
          sent++;
        } catch (error) {
          const statusCode = typeof error === "object" && error !== null && "statusCode" in error
            ? error.statusCode
            : undefined;
          if (statusCode === 404 || statusCode === 410) {
            invalidEndpoints.add(subscription.endpoint);
          }
        }
      }
    }

    for (const subscription of orphaned) {
      attempted++;
      try {
        await webPush.sendNotification(subscription, payload);
        sent++;
      } catch (error) {
        const statusCode = typeof error === "object" && error !== null && "statusCode" in error
          ? error.statusCode
          : undefined;
        if (statusCode === 404 || statusCode === 410) {
          invalidEndpoints.add(subscription.endpoint);
        }
      }
    }

    if (invalidEndpoints.size > 0) {
      await writeSubscriptions(allSubscriptions.filter((s) => !invalidEndpoints.has(s.endpoint)));
    }

    return Response.json({
      notificationTriggered: true,
      date: today,
      timezone: TIMEZONE,
      sent,
      attempted,
      removed: invalidEndpoints.size,
    });
  } catch (error) {
    return Response.json({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
