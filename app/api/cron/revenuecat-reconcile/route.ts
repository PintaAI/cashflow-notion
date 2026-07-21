import { prisma } from "@/lib/db";
import { reconcileBilling } from "@/lib/billing";

const CRON_BATCH_SIZE = 20;

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = { failedEvents: 0, reconciledUsers: 0, deletionJobs: 0 };

  const pendingEvents = await prisma.revenueCatWebhookEvent.findMany({
    where: { status: { in: ["pending", "failed"] } },
    orderBy: { receivedAt: "asc" },
    take: CRON_BATCH_SIZE,
  });

  for (const event of pendingEvents) {
    try {
      const payload = event.rawPayload as Record<string, unknown> | null;
      const appUserId = payload?.event && typeof payload.event === "object"
        ? (payload.event as Record<string, unknown>).app_user_id
        : null;
      if (appUserId && typeof appUserId === "string") {
        const user = await prisma.user.findUnique({
          where: { revenueCatAppUserId: appUserId },
          select: { id: true },
        });
        if (user) {
          await reconcileBilling(user.id);
          results.reconciledUsers += 1;
        }
      }
      await prisma.revenueCatWebhookEvent.update({
        where: { eventId: event.eventId },
        data: { status: "processed", processedAt: new Date(), lastError: null },
      });
    } catch {
      await prisma.revenueCatWebhookEvent.update({
        where: { eventId: event.eventId },
        data: { status: "failed", attempts: { increment: 1 } },
      });
      results.failedEvents += 1;
    }
  }

  const staleUsers = await prisma.userEntitlement.findMany({
    where: {
      active: true,
      reconciledAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { userId: true },
    orderBy: { reconciledAt: "asc" },
    take: CRON_BATCH_SIZE,
  });

  for (const { userId } of staleUsers) {
    try {
      await reconcileBilling(userId);
      results.reconciledUsers += 1;
    } catch {
      // stale projections are not blocking
    }
  }

  const deletionJobs = await prisma.revenueCatDeletionJob.findMany({
    where: { revenueCatDeletedAt: null },
    orderBy: { requestedAt: "asc" },
    take: CRON_BATCH_SIZE,
  });

  for (const job of deletionJobs) {
    try {
      const { deleteRevenueCatCustomer } = await import("@/lib/revenuecat");
      await deleteRevenueCatCustomer(job.revenueCatAppUserId);
      await prisma.revenueCatDeletionJob.update({
        where: { id: job.id },
        data: {
          revenueCatDeletedAt: new Date(),
          lastError: null,
          attempts: { increment: 1 },
        },
      });
      results.deletionJobs += 1;
    } catch (error) {
      await prisma.revenueCatDeletionJob.update({
        where: { id: job.id },
        data: {
          lastError: error instanceof Error ? error.message : "Unknown error",
          attempts: { increment: 1 },
        },
      });
    }
  }

  return Response.json({ data: results });
}
