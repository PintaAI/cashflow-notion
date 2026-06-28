import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Redis } from "@upstash/redis";
import webPush, { type PushSubscription } from "web-push";
import { putObject, getObjectText, getR2Client } from "@/lib/r2";

const SUBSCRIPTIONS_FILE = path.join(process.cwd(), "data", "push-subscriptions.json");
const SUBSCRIPTIONS_KV_KEY = "push-subscriptions";
const SUBSCRIPTIONS_BLOB_PATH = "notifications/push-subscriptions.json";

export type StoredPushSubscription = PushSubscription & {
  createdAt: string;
  updatedAt: string;
  userId?: string;
  managementId?: string;
};

export interface DailyNotificationResult {
  attempted: number;
  sent: number;
  removed: number;
}

async function ensureDataDir() {
  await mkdir(path.dirname(SUBSCRIPTIONS_FILE), { recursive: true });
}

export async function writeSubscriptions(subscriptions: StoredPushSubscription[]) {
  const redis = getRedisClient();

  if (redis) {
    await redis.set(SUBSCRIPTIONS_KV_KEY, subscriptions);
    return;
  }

  if (getR2Client()) {
    try {
      await putObject(SUBSCRIPTIONS_BLOB_PATH, JSON.stringify(subscriptions), "application/json");
      return;
    } catch {
      // R2 write failed, fall through to JSON
    }
  }

  await ensureDataDir();
  await writeFile(SUBSCRIPTIONS_FILE, `${JSON.stringify(subscriptions, null, 2)}\n`, "utf8");
}

function getRedisClient() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({ url, token });
}

function normalizeSubscriptions(value: unknown): StoredPushSubscription[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is StoredPushSubscription => {
    return Boolean(
      item &&
      typeof item === "object" &&
      "endpoint" in item &&
      typeof item.endpoint === "string"
    );
  });
}

export async function readSubscriptions(): Promise<StoredPushSubscription[]> {
  const redis = getRedisClient();

  if (redis) {
    const subscriptions = await redis.get<StoredPushSubscription[]>(SUBSCRIPTIONS_KV_KEY);
    return normalizeSubscriptions(subscriptions);
  }

  if (getR2Client()) {
    try {
      const data = await getObjectText(SUBSCRIPTIONS_BLOB_PATH);
      if (data !== null) {
        return normalizeSubscriptions(JSON.parse(data));
      }
      return [];
    } catch {
      return [];
    }
  }

  try {
    const data = await readFile(SUBSCRIPTIONS_FILE, "utf8");
    return normalizeSubscriptions(JSON.parse(data));
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

export function configureWebPush() {
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
