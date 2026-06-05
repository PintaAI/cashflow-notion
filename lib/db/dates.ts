import type { BudgetPeriod } from "@/lib/db/types";
import { getWeekNumber, getWeekStartEnd, toIsoDateKey } from "@/lib/date";

export { getWeekNumber, getWeekStartEnd } from "@/lib/date";

export function formatDate(date: Date): string {
  return toIsoDateKey(date);
}

export function getCurrentDateRange(period: BudgetPeriod): { start: string; end: string } {
  const now = new Date();

  if (period === "daily") {
    const date = formatDate(now);
    return { start: date, end: date };
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

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: formatDate(start), end: formatDate(end) };
}
