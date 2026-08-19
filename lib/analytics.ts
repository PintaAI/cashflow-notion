import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { CategoryType, IOType } from "@/lib/db";
import { addDaysToDateKey, addDays, getMondayOfWeek, startOfDay, toDateKey } from "@/lib/date";
import { toNumber } from "@/lib/number";

export interface AnalyticsFilter {
  io?: IOType;
  category?: CategoryType;
  startDate?: string;
  endDate?: string;
}

export interface URLAnalyticsFilter {
  from?: string;
  to?: string;
  allTime?: boolean;
  io?: IOType;
  category?: CategoryType;
}

export interface CategoryAnalytics {
  category: string;
  color?: string;
  total: number;
  count: number;
  percentage: number;
}

export interface MonthlyAnalytics {
  month: string;
  year: number;
  monthLabel: string;
  income: number;
  expenses: number;
  net: number;
}

export interface DailyAnalytics {
  date: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CreatorAnalytics {
  userId: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
  totalIncome: number;
  totalExpenses: number;
  entryCount: number;
}

export interface ActivityDay {
  date: string;
  count: number;
}

export interface ActivityOverview {
  days: ActivityDay[];
  totalEntries: number;
  activeDays: number;
  currentStreak: number;
}

export interface AnalyticsData {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    entryCount: number;
  };
  byCategory: CategoryAnalytics[];
  byMonth: MonthlyAnalytics[];
  byDay: DailyAnalytics[];
  byCreator: CreatorAnalytics[];
  filteredBy: AnalyticsFilter;
}

function getCurrentStreak(activeDateKeys: Set<string>, today: Date): number {
  let streak = 0;
  let cursor = startOfDay(today);

  while (activeDateKeys.has(toDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function urlFilterToAnalyticsFilter(urlFilter: URLAnalyticsFilter): AnalyticsFilter {
  return {
    io: urlFilter.io,
    category: urlFilter.category,
    startDate: urlFilter.from,
    endDate: urlFilter.to ? addDaysToDateKey(urlFilter.to, 1) : undefined,
  };
}

function buildAnalyticsWhereSql(filter: AnalyticsFilter, managementId: string) {
  const conditions = [Prisma.sql`e."managementId" = ${managementId}`, Prisma.sql`e."deletedAt" IS NULL`];

  if (filter.io) {
    conditions.push(Prisma.sql`e."io"::text = ${filter.io}`);
  }
  if (filter.category) {
    conditions.push(Prisma.sql`c."name" = ${filter.category}`);
  }
  if (filter.startDate) {
    conditions.push(Prisma.sql`e."date" >= ${filter.startDate}`);
  }
  if (filter.endDate) {
    conditions.push(Prisma.sql`e."date" < ${filter.endDate}`);
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

type SummaryRow = {
  totalIncome: number | string | null;
  totalExpenses: number | string | null;
  entryCount: number | bigint;
};

type CategoryRow = {
  category: string;
  color: string | null;
  total: number | string | null;
  count: number | bigint;
};

type PeriodRow = {
  period: string;
  io: string | null;
  total: number | string | null;
};

type CreatorRow = {
  userId: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
  totalIncome: number | string | null;
  totalExpenses: number | string | null;
  entryCount: number | bigint;
};

type ActivityRow = {
  date: Date | string;
  count: number | bigint;
};

export async function fetchAnalyticsFromURL(urlFilter: URLAnalyticsFilter = {}, managementId: string): Promise<AnalyticsData> {
  return fetchAnalytics(urlFilterToAnalyticsFilter(urlFilter), managementId);
}

export async function fetchAnalytics(filter: AnalyticsFilter = {}, managementId: string): Promise<AnalyticsData> {
  const whereSql = buildAnalyticsWhereSql(filter, managementId);
  const summaryRows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      COALESCE(SUM(e."nominal") FILTER (WHERE e."io"::text = 'Income'), 0) AS "totalIncome",
      COALESCE(SUM(e."nominal") FILTER (WHERE e."io"::text = 'Expenses'), 0) AS "totalExpenses",
      COUNT(*) AS "entryCount"
    FROM "Entry" e
    LEFT JOIN "Category" c ON c."id" = e."categoryId"
    ${whereSql}
  `;
  const summaryRow = summaryRows[0] || { totalIncome: 0, totalExpenses: 0, entryCount: 0 };
  const summary = {
    totalIncome: toNumber(summaryRow.totalIncome),
    totalExpenses: toNumber(summaryRow.totalExpenses),
    balance: toNumber(summaryRow.totalIncome) - toNumber(summaryRow.totalExpenses),
    entryCount: toNumber(summaryRow.entryCount),
  };

  const [categoryRows, monthRows, dayRows, creatorRows] = await Promise.all([
    prisma.$queryRaw<CategoryRow[]>`
      SELECT c."name" AS "category", c."color" AS "color", COALESCE(SUM(e."nominal"), 0) AS "total", COUNT(*) AS "count"
      FROM "Entry" e
      INNER JOIN "Category" c ON c."id" = e."categoryId"
      ${whereSql}
      GROUP BY c."name", c."color"
      ORDER BY "total" DESC
    `,
    prisma.$queryRaw<PeriodRow[]>`
      SELECT LEFT(e."date", 7) AS "period", e."io"::text AS "io", COALESCE(SUM(e."nominal"), 0) AS "total"
      FROM "Entry" e
      LEFT JOIN "Category" c ON c."id" = e."categoryId"
      ${whereSql}
      AND e."date" IS NOT NULL
      GROUP BY LEFT(e."date", 7), e."io"
      ORDER BY "period" ASC
    `,
    prisma.$queryRaw<PeriodRow[]>`
      SELECT e."date" AS "period", e."io"::text AS "io", COALESCE(SUM(e."nominal"), 0) AS "total"
      FROM "Entry" e
      LEFT JOIN "Category" c ON c."id" = e."categoryId"
      ${whereSql}
      AND e."date" IS NOT NULL
      GROUP BY e."date", e."io"
      ORDER BY e."date" ASC
    `,
    prisma.$queryRaw<CreatorRow[]>`
      SELECT
        e."createdById" AS "userId",
        u."name" AS "name",
        u."email" AS "email",
        u."image" AS "image",
        COALESCE(SUM(e."nominal") FILTER (WHERE e."io"::text = 'Income'), 0) AS "totalIncome",
        COALESCE(SUM(e."nominal") FILTER (WHERE e."io"::text = 'Expenses'), 0) AS "totalExpenses",
        COUNT(*) AS "entryCount"
      FROM "Entry" e
      LEFT JOIN "Category" c ON c."id" = e."categoryId"
      LEFT JOIN "User" u ON u."id" = e."createdById"
      ${whereSql}
      GROUP BY e."createdById", u."name", u."email", u."image"
      ORDER BY "totalExpenses" DESC, "totalIncome" DESC, "entryCount" DESC
    `,
  ]);

  const monthMap = new Map<string, { income: number; expenses: number }>();
  for (const row of monthRows) {
    const existing = monthMap.get(row.period) || { income: 0, expenses: 0 };
    if (row.io === "Income") existing.income = toNumber(row.total);
    if (row.io === "Expenses") existing.expenses = toNumber(row.total);
    monthMap.set(row.period, existing);
  }

  const dayMap = new Map<string, { income: number; expenses: number }>();
  for (const row of dayRows) {
    const existing = dayMap.get(row.period) || { income: 0, expenses: 0 };
    if (row.io === "Income") existing.income = toNumber(row.total);
    if (row.io === "Expenses") existing.expenses = toNumber(row.total);
    dayMap.set(row.period, existing);
  }

  const totalForPercentage = summary.totalIncome + summary.totalExpenses;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return {
    summary,
    byCategory: categoryRows
      .map((data) => {
        const total = toNumber(data.total);
        return {
          category: data.category,
          color: data.color ?? undefined,
          total,
          count: toNumber(data.count),
          percentage: totalForPercentage > 0 ? (total / totalForPercentage) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total),
    byMonth: Array.from(monthMap.entries())
      .map(([key, data]) => {
        const [year, month] = key.split("-").map(Number);
        return {
          month: key,
          year,
          monthLabel: `${monthNames[month - 1]} ${year}`,
          income: data.income,
          expenses: data.expenses,
          net: data.income - data.expenses,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month)),
    byDay: Array.from(dayMap.entries())
      .map(([date, data]) => ({
        date,
        income: data.income,
        expenses: data.expenses,
        net: data.income - data.expenses,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byCreator: creatorRows.map((row) => ({
      userId: row.userId,
      name: row.name,
      email: row.email,
      image: row.image,
      totalIncome: toNumber(row.totalIncome),
      totalExpenses: toNumber(row.totalExpenses),
      entryCount: toNumber(row.entryCount),
    })),
    filteredBy: filter,
  };
}

export async function fetchActivityOverview(daysBack = 182, managementId: string): Promise<ActivityOverview> {
  const today = startOfDay(new Date());
  const startDate = addDays(today, -(daysBack - 1));
  const alignedStartDate = getMondayOfWeek(startDate);
  const alignedStartDateKey = toDateKey(alignedStartDate);
  const [rows, streakRows] = await Promise.all([
    prisma.$queryRaw<ActivityRow[]>`
      SELECT e."date" AS "date", COUNT(*) AS "count"
      FROM "Entry" e
      WHERE e."deletedAt" IS NULL AND e."date" >= ${alignedStartDateKey} AND e."managementId" = ${managementId}
      GROUP BY e."date"
      ORDER BY "date" ASC
    `,
    prisma.$queryRaw<ActivityRow[]>`
      SELECT DATE(e."createdAt") AS "date", COUNT(*) AS "count"
      FROM "Entry" e
      WHERE e."deletedAt" IS NULL AND e."createdAt" >= ${alignedStartDate} AND e."managementId" = ${managementId}
      GROUP BY DATE(e."createdAt")
      ORDER BY "date" ASC
    `,
  ]);

  const dayMap = new Map<string, ActivityDay>();
  for (const row of rows) {
    const dateKey = typeof row.date === "string" ? row.date : toDateKey(row.date);
    const existing = dayMap.get(dateKey) || { date: dateKey, count: 0 };
    existing.count += toNumber(row.count);
    dayMap.set(dateKey, existing);
  }

  const totalDays = daysBack + (startDate.getTime() - alignedStartDate.getTime()) / (24 * 60 * 60 * 1000);
  const days: ActivityDay[] = [];
  for (let i = 0; i < Math.ceil(totalDays); i += 1) {
    const date = addDays(alignedStartDate, i);
    const dateKey = toDateKey(date);
    days.push(dayMap.get(dateKey) || { date: dateKey, count: 0 });
  }

  const activeDateKeys = new Set(days.filter((day) => day.count > 0).map((day) => day.date));
  const createdDateKeys = new Set(streakRows.map((row) => (typeof row.date === "string" ? row.date : toDateKey(row.date))));

  return {
    days,
    totalEntries: days.reduce((total, day) => total + day.count, 0),
    activeDays: activeDateKeys.size,
    currentStreak: getCurrentStreak(createdDateKeys, today),
  };
}

export async function fetchFilteredSummary(filter: AnalyticsFilter = {}, managementId: string): Promise<{
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  entryCount: number;
}> {
  const analytics = await fetchAnalytics(filter, managementId);
  return analytics.summary;
}
