import { prisma } from "@/lib/db/client";
import { formatDate, getWeekNumber, getWeekStartEnd } from "@/lib/db/dates";
import type { CashflowSummary } from "@/lib/db/types";
import { toNumber } from "@/lib/number";

type SummaryCategoryRow = {
  category: string;
  total: number | string | null;
  expenseTotal: number | string | null;
  expenseCount: number | bigint;
};

type SummaryDayRow = {
  date: string;
  io: string | null;
  total: number | string | null;
};

export async function getSummary(managementId: string): Promise<CashflowSummary> {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const { start: weekStart, end: weekEnd } = getWeekStartEnd(now);

  const categoryWindowDate = new Date(now);
  categoryWindowDate.setFullYear(categoryWindowDate.getFullYear() - 1);
  const categoryWindow = formatDate(categoryWindowDate);

  const dayWindowDate = new Date(now);
  dayWindowDate.setDate(dayWindowDate.getDate() - 90);
  const dayWindow = formatDate(dayWindowDate);

  const [entryCount, incomeAgg, expensesAgg, categoryRows, dayRows] = await Promise.all([
    prisma.entry.count({ where: { managementId, deletedAt: null } }),
    prisma.entry.aggregate({ where: { managementId, io: "Income", deletedAt: null }, _sum: { nominal: true } }),
    prisma.entry.aggregate({ where: { managementId, io: "Expenses", deletedAt: null }, _sum: { nominal: true } }),
    prisma.$queryRaw<SummaryCategoryRow[]>`
      SELECT
        c."name" AS "category",
        COALESCE(SUM(e."nominal"), 0) AS "total",
        COALESCE(SUM(e."nominal") FILTER (WHERE e."io"::text = 'Expenses'), 0) AS "expenseTotal",
        COUNT(*) FILTER (WHERE e."io"::text = 'Expenses') AS "expenseCount"
      FROM "Entry" e
      INNER JOIN "Category" c ON c."id" = e."categoryId"
      WHERE e."managementId" = ${managementId} AND e."deletedAt" IS NULL AND e."date" >= ${categoryWindow}
      GROUP BY c."name"
    `,
    prisma.$queryRaw<SummaryDayRow[]>`
      SELECT "date", "io"::text AS "io", COALESCE(SUM("nominal"), 0) AS "total"
      FROM "Entry"
      WHERE "deletedAt" IS NULL AND "date" IS NOT NULL AND "managementId" = ${managementId} AND "date" >= ${dayWindow}
      GROUP BY "date", "io"
    `,
  ]);

  const totalEntries = entryCount;
  const totalIncome = incomeAgg._sum.nominal ?? 0;
  const totalExpenses = expensesAgg._sum.nominal ?? 0;

  const categoryMap = new Map<string, { total: number; count: number }>();
  const weeklyMap = new Map<string, { income: number; expenses: number }>();
  const monthlyMap = new Map<string, { income: number; expenses: number }>();

  const summary: Omit<CashflowSummary, "currentWeek" | "currentMonth" | "topExpenseCategories" | "weeklyBreakdown"> = {
    totalEntries,
    totalIncome,
    totalExpenses,
    balance: 0,
    byCategory: {},
    byIO: {
      Income: totalIncome,
      Expenses: totalExpenses,
    },
  };

  for (const row of categoryRows) {
    summary.byCategory[row.category] = toNumber(row.total);
    categoryMap.set(row.category, {
      total: toNumber(row.expenseTotal),
      count: toNumber(row.expenseCount),
    });
  }

  for (const row of dayRows) {
    if (row.date) {
      const entryDate = new Date(row.date);
      const weekKey = formatDate(getWeekStartEnd(entryDate).start);
      const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}`;

      if (!weeklyMap.has(weekKey)) weeklyMap.set(weekKey, { income: 0, expenses: 0 });
      if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, { income: 0, expenses: 0 });

      const weekData = weeklyMap.get(weekKey)!;
      const monthData = monthlyMap.get(monthKey)!;
      const total = toNumber(row.total);

      if (row.io === "Income") {
        weekData.income += total;
        monthData.income += total;
      } else if (row.io === "Expenses") {
        weekData.expenses += total;
        monthData.expenses += total;
      }
    }
  }

  summary.balance = summary.totalIncome - summary.totalExpenses;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const currentWeekKey = formatDate(weekStart);
  const currentMonthData = monthlyMap.get(currentMonthKey) || { income: 0, expenses: 0 };
  const currentWeekData = weeklyMap.get(currentWeekKey) || { income: 0, expenses: 0 };

  return {
    ...summary,
    currentWeek: {
      weekNumber: getWeekNumber(now),
      weekStart: formatDate(weekStart),
      weekEnd: formatDate(weekEnd),
      income: currentWeekData.income,
      expenses: currentWeekData.expenses,
    },
    currentMonth: {
      month: currentMonthKey,
      monthName: monthNames[currentMonth],
      year: currentYear,
      income: currentMonthData.income,
      expenses: currentMonthData.expenses,
    },
    topExpenseCategories: Array.from(categoryMap.entries())
      .filter(([, data]) => data.count > 0)
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: summary.totalExpenses > 0 ? (data.total / summary.totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    weeklyBreakdown: Array.from(weeklyMap.entries())
      .map(([weekStartValue, data]) => {
        const startDate = new Date(weekStartValue);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);

        return {
          weekNumber: getWeekNumber(startDate),
          weekStart: formatDate(startDate),
          weekEnd: formatDate(endDate),
          income: data.income,
          expenses: data.expenses,
        };
      })
      .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())
      .slice(0, 8),
  };
}
