import { prisma } from "@/lib/db";
import { configureWebPush, readSubscriptions, writeSubscriptions } from "@/lib/notifications";
import webPush from "web-push";

const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown per budget+period

const lastAlertTimestamps = new Map<string, number>();

function getAlertKey(managementId: string, type: "category" | "overall", id: string, period: string, threshold: string): string {
  return `${managementId}:${type}:${id}:${period}:${threshold}`;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getWeekStartEnd(date: Date): { start: Date; end: Date } {
  const day = date.getDay();
  const diff = date.getDate() - day;
  const start = new Date(date.getFullYear(), date.getMonth(), diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function getDateRange(period: string): { start: string; end: string } {
  const now = new Date();

  if (period === "daily") {
    const d = formatDate(now);
    return { start: d, end: d };
  }

  if (period === "weekly") {
    const { start, end } = getWeekStartEnd(now);
    return { start: formatDate(start), end: formatDate(end) };
  }

  if (period === "yearly") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { start: formatDate(start), end: formatDate(end) };
  }

  // monthly
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: formatDate(start), end: formatDate(end) };
}

async function sendBudgetNotification(managementId: string, title: string, body: string): Promise<void> {
  try {
    configureWebPush();
  } catch {
    return; // VAPID not configured
  }

  const subscriptions = await readSubscriptions();
  const managementSubs = subscriptions.filter((s) => s.managementId === managementId);

  if (managementSubs.length === 0) return;

  const payload = JSON.stringify({ title, body, url: "/?tab=setting" });
  const invalidEndpoints = new Set<string>();

  await Promise.all(
    managementSubs.map(async (subscription) => {
      try {
        await webPush.sendNotification(subscription, payload);
      } catch (error) {
        const statusCode = typeof error === "object" && error !== null && "statusCode" in error
          ? (error as { statusCode: number }).statusCode
          : undefined;
        if (statusCode === 404 || statusCode === 410) {
          invalidEndpoints.add(subscription.endpoint);
        }
      }
    }),
  );

  if (invalidEndpoints.size > 0) {
    const allSubs = await readSubscriptions();
    await writeSubscriptions(allSubs.filter((s) => !invalidEndpoints.has(s.endpoint)));
  }
}

export async function checkBudgetAlerts(
  managementId: string,
  entry: { categoryId?: string | null; io?: string | null; date?: string | null },
): Promise<void> {
  if (entry.io !== "Expenses" || !entry.date) return;

  const now = Date.now();
  const periods = ["daily", "weekly", "monthly", "yearly"];

  for (const period of periods) {
    const { start, end } = getDateRange(period);

    // Check category-specific budget
    if (entry.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: entry.categoryId },
      });

      if (category) {
        const budgetAmount = period === "daily"
          ? category.budgetDaily
          : period === "weekly"
            ? category.budgetWeekly
            : category.budgetMonthly;

        if (budgetAmount != null && budgetAmount > 0) {
          const spent = await prisma.entry.aggregate({
            where: {
              managementId,
              io: "Expenses",
              categoryId: category.id,
              date: { gte: start, lte: end },
            },
            _sum: { nominal: true },
          });

          const totalSpent = spent._sum.nominal ?? 0;
          const percentage = Math.round((totalSpent / budgetAmount) * 100);

          const periodLabel = period === "daily" ? "harian" : period === "weekly" ? "mingguan" : period === "monthly" ? "bulanan" : "tahunan";

          if (percentage >= 100) {
            const key = getAlertKey(managementId, "category", category.id, period, "100");
            if (now - (lastAlertTimestamps.get(key) ?? 0) > ALERT_COOLDOWN_MS) {
              lastAlertTimestamps.set(key, now);
              await sendBudgetNotification(
                managementId,
                `Budget ${category.name} terlampaui!`,
                `Pengeluaran ${periodLabel} ${category.name} mencapai Rp ${Math.round(totalSpent).toLocaleString("id-ID")} dari budget Rp ${Math.round(budgetAmount).toLocaleString("id-ID")} (${percentage}%)`,
              );
            }
          } else if (percentage >= 80) {
            const key = getAlertKey(managementId, "category", category.id, period, "80");
            if (now - (lastAlertTimestamps.get(key) ?? 0) > ALERT_COOLDOWN_MS) {
              lastAlertTimestamps.set(key, now);
              await sendBudgetNotification(
                managementId,
                `Budget ${category.name} mendekati batas`,
                `Pengeluaran ${periodLabel} ${category.name} sudah ${percentage}% (Rp ${Math.round(totalSpent).toLocaleString("id-ID")} / Rp ${Math.round(budgetAmount).toLocaleString("id-ID")})`,
              );
            }
          }
        }
      }
    }

    // Check overall budget
    const overallBudget = await prisma.overallBudget.findUnique({
      where: { managementId_period: { managementId, period } },
    });

    if (overallBudget && overallBudget.amount > 0) {
      const spent = await prisma.entry.aggregate({
        where: {
          managementId,
          io: "Expenses",
          date: { gte: start, lte: end },
        },
        _sum: { nominal: true },
      });

      const totalSpent = spent._sum.nominal ?? 0;
      const percentage = Math.round((totalSpent / overallBudget.amount) * 100);
      const periodLabel = period === "daily" ? "harian" : period === "weekly" ? "mingguan" : period === "monthly" ? "bulanan" : "tahunan";

      if (percentage >= 100) {
        const key = getAlertKey(managementId, "overall", overallBudget.id, period, "100");
        if (now - (lastAlertTimestamps.get(key) ?? 0) > ALERT_COOLDOWN_MS) {
          lastAlertTimestamps.set(key, now);
          await sendBudgetNotification(
            managementId,
            `Budget ${periodLabel} terlampaui!`,
            `Total pengeluaran ${periodLabel} mencapai Rp ${Math.round(totalSpent).toLocaleString("id-ID")} dari budget Rp ${Math.round(overallBudget.amount).toLocaleString("id-ID")} (${percentage}%)`,
          );
        }
      } else if (percentage >= 80) {
        const key = getAlertKey(managementId, "overall", overallBudget.id, period, "80");
        if (now - (lastAlertTimestamps.get(key) ?? 0) > ALERT_COOLDOWN_MS) {
          lastAlertTimestamps.set(key, now);
          await sendBudgetNotification(
            managementId,
            `Budget ${periodLabel} mendekati batas`,
            `Total pengeluaran ${periodLabel} sudah ${percentage}% (Rp ${Math.round(totalSpent).toLocaleString("id-ID")} / Rp ${Math.round(overallBudget.amount).toLocaleString("id-ID")})`,
          );
        }
      }
    }
  }
}
