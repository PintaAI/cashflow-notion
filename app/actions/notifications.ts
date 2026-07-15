"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import {
  sendExpoPush,
  validateExpoPushPayload,
  type ExpoPushResult,
} from "@/lib/expo-push";

export async function getNotificationStats() {
  await requireAdmin();

  const [tokenCount, userGroups, platformCounts] = await Promise.all([
    prisma.expoPushToken.count(),
    prisma.expoPushToken
      .groupBy({ by: ["userId"] })
      .then((groups) => groups.length),
    prisma.expoPushToken.groupBy({
      by: ["platform"],
      _count: true,
    }),
  ]);

  return {
    totalTokens: tokenCount,
    distinctUsers: userGroups,
    platformBreakdown: Object.fromEntries(
      platformCounts.map((p) => [p.platform, p._count]),
    ),
  };
}

export async function listPushTokens() {
  await requireAdmin();

  const tokens = await prisma.expoPushToken.findMany({
    select: {
      id: true,
      platform: true,
      userId: true,
      managementId: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { name: true, email: true } },
      management: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return tokens.map((t) => ({
    id: t.id,
    platform: t.platform,
    userId: t.userId,
    userName: t.user.name ?? t.user.email,
    managementId: t.managementId,
    managementName: t.management?.name ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
}

function parseCustomData(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON in custom data");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Custom data must be a JSON object (not array, string, or number)");
  }

  if ("url" in parsed) {
    throw new Error("Custom data must not contain a \"url\" key");
  }

  return parsed as Record<string, unknown>;
}

export async function sendTestNotification(formData: {
  targetType: "token" | "user" | "management" | "all";
  targetId?: string | null;
  title: string;
  body: string;
  url?: string;
  dataJson?: string;
}): Promise<{
  result: ExpoPushResult;
  removed: number;
  ticketIds: string[];
}> {
  await requireAdmin();

  const title = formData.title?.trim() ?? "";
  const body = formData.body?.trim() ?? "";
  const url = formData.url?.trim() || undefined;

  const data = parseCustomData(formData.dataJson);

  const validationError = validateExpoPushPayload({
    title,
    body,
    url,
    data,
  });
  if (validationError) throw new Error(validationError);

  if (
    formData.targetType === "token" ||
    formData.targetType === "user" ||
    formData.targetType === "management"
  ) {
    if (!formData.targetId) {
      throw new Error(`Target ID is required for type "${formData.targetType}"`);
    }
  }

  let recipients: { id: string; token: string }[];
  switch (formData.targetType) {
    case "token":
      recipients = await prisma.expoPushToken.findMany({
        where: { id: formData.targetId! },
        select: { id: true, token: true },
      });
      break;
    case "user":
      recipients = await prisma.expoPushToken.findMany({
        where: { userId: formData.targetId! },
        select: { id: true, token: true },
      });
      break;
    case "management":
      recipients = await prisma.expoPushToken.findMany({
        where: { managementId: formData.targetId! },
        select: { id: true, token: true },
      });
      break;
    case "all":
      recipients = await prisma.expoPushToken.findMany({
        select: { id: true, token: true },
      });
      break;
    default:
      throw new Error("Invalid target type");
  }

  if (recipients.length === 0) {
    throw new Error("No push tokens match the selected target");
  }

  const expoRecipients = recipients.map((r) => ({
    token: r.token,
    id: r.id,
  }));
  const result = await sendExpoPush(expoRecipients, {
    title,
    body,
    url,
    data,
  });

  // DeviceNotRegistered cleanup: ticket indices map 1:1 to recipients
  let removed = 0;
  if (result.deviceNotRegisteredCount > 0) {
    for (let i = 0; i < result.tickets.length; i++) {
      if (result.tickets[i].details?.error === "DeviceNotRegistered") {
        const dbId = recipients[i]?.id;
        if (dbId) {
          await prisma.expoPushToken
            .delete({ where: { id: dbId } })
            .catch(() => {});
          removed++;
        }
      }
    }
  }

  return {
    result,
    removed,
    ticketIds: result.tickets.map((t) => t.id),
  };
}
