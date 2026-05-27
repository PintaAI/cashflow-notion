import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import webPush, { type PushSubscription } from "web-push";

const SUBSCRIPTIONS_FILE = path.join(process.cwd(), "data", "push-subscriptions.json");

export type StoredPushSubscription = PushSubscription & {
  createdAt: string;
  updatedAt: string;
};

export interface DailyNotificationResult {
  attempted: number;
  sent: number;
  removed: number;
}

async function ensureDataDir() {
  await mkdir(path.dirname(SUBSCRIPTIONS_FILE), { recursive: true });
}

async function writeSubscriptions(subscriptions: StoredPushSubscription[]) {
  await ensureDataDir();
  await writeFile(SUBSCRIPTIONS_FILE, `${JSON.stringify(subscriptions, null, 2)}\n`, "utf8");
}

export async function readSubscriptions(): Promise<StoredPushSubscription[]> {
  try {
    const data = await readFile(SUBSCRIPTIONS_FILE, "utf8");
    const parsed = JSON.parse(data) as StoredPushSubscription[];
    return Array.isArray(parsed) ? parsed.filter((item) => item.endpoint) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function saveSubscription(subscription: PushSubscription) {
  const subscriptions = await readSubscriptions();
  const now = new Date().toISOString();
  const index = subscriptions.findIndex((item) => item.endpoint === subscription.endpoint);
  const stored: StoredPushSubscription = {
    ...subscription,
    createdAt: index >= 0 ? subscriptions[index].createdAt : now,
    updatedAt: now,
  };

  if (index >= 0) {
    subscriptions[index] = stored;
  } else {
    subscriptions.push(stored);
  }

  await writeSubscriptions(subscriptions);
  return stored;
}

export async function removeSubscription(endpoint: string) {
  const subscriptions = await readSubscriptions();
  const nextSubscriptions = subscriptions.filter((item) => item.endpoint !== endpoint);
  await writeSubscriptions(nextSubscriptions);
  return subscriptions.length - nextSubscriptions.length;
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("Missing VAPID configuration for push notifications");
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
}

export async function sendDailyReminder(): Promise<DailyNotificationResult> {
  configureWebPush();

  const subscriptions = await readSubscriptions();
  const payload = JSON.stringify({
    title: "Cashflow reminder",
    body: "No cashflow entry yet today. Add one before you forget.",
    url: "/?action=add",
  });

  let sent = 0;
  const invalidEndpoints = new Set<string>();

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(subscription, payload);
        sent += 1;
      } catch (error) {
        const statusCode = typeof error === "object" && error !== null && "statusCode" in error
          ? error.statusCode
          : undefined;

        if (statusCode === 404 || statusCode === 410) {
          invalidEndpoints.add(subscription.endpoint);
          return;
        }

        throw error;
      }
    })
  );

  if (invalidEndpoints.size > 0) {
    await writeSubscriptions(subscriptions.filter((item) => !invalidEndpoints.has(item.endpoint)));
  }

  return {
    attempted: subscriptions.length,
    sent,
    removed: invalidEndpoints.size,
  };
}
