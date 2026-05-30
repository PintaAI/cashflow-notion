import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type IOType = "Income" | "Expenses";
export type CategoryType = string;

export interface CashflowProperty {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  options?: Array<{ id: string; name: string; color: string }>;
  format?: string;
}

export interface CashflowEntry {
  id: string;
  name: string;
  nominal: number;
  category: CategoryType | null;
  date: string | null;
  io: IOType | null;
}

export interface CategorySpend {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface WeeklyStats {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  income: number;
  expenses: number;
}

export interface MonthlyStats {
  month: string;
  monthName: string;
  year: number;
  income: number;
  expenses: number;
}

export interface CashflowSummary {
  totalEntries: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  byCategory: Record<string, number>;
  byIO: Record<string, number>;
  currentWeek: WeeklyStats;
  currentMonth: MonthlyStats;
  topExpenseCategories: CategorySpend[];
  weeklyBreakdown: WeeklyStats[];
}

export interface CategoryOptionWithColor {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

export type CategoryOptionWithUsage = CategoryOptionWithColor & {
  usageCount: number;
};

type EntryWithCategory = Prisma.EntryGetPayload<{
  include: { category: true };
}>;

export type EntryWhereInput = Prisma.EntryWhereInput;

type SummaryRow = {
  totalIncome: number | string | null;
  totalExpenses: number | string | null;
  totalEntries: number | bigint;
};

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

function toNumber(value: number | string | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function toEntry(entry: EntryWithCategory): CashflowEntry {
  return {
    id: entry.id,
    name: entry.name,
    nominal: entry.nominal,
    category: entry.category?.name ?? null,
    date: entry.date,
    io: entry.io,
  };
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getWeekNumber(date: Date): number {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const pastDaysOfMonth = date.getDate() + firstDayOfMonth.getDay() - 1;
  return Math.ceil(pastDaysOfMonth / 7);
}

function getWeekStartEnd(date: Date): { start: Date; end: Date } {
  const day = date.getDay();
  const diff = date.getDate() - day;
  const start = new Date(date.getFullYear(), date.getMonth(), diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export function buildEntryWhere(filter: {
  io?: IOType;
  category?: CategoryType;
  date?: string;
  startDate?: string;
  endDate?: string;
} = {}): EntryWhereInput {
  return {
    ...(filter.io ? { io: filter.io } : {}),
    ...(filter.category ? { category: { is: { name: filter.category } } } : {}),
    ...(filter.date
      ? { date: filter.date }
      : filter.startDate || filter.endDate
        ? {
            date: {
              ...(filter.startDate ? { gte: filter.startDate } : {}),
              ...(filter.endDate ? { lt: filter.endDate } : {}),
            },
          }
        : {}),
  };
}

export async function getAllEntries(): Promise<CashflowEntry[]> {
  const entries = await prisma.entry.findMany({
    include: { category: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return entries.map(toEntry);
}

export async function getSummary(): Promise<CashflowSummary> {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const { start: weekStart, end: weekEnd } = getWeekStartEnd(now);

  const [summaryRows, categoryRows, dayRows] = await Promise.all([
    prisma.$queryRaw<SummaryRow[]>`
      SELECT
        COUNT(*) AS "totalEntries",
        COALESCE(SUM("nominal") FILTER (WHERE "io"::text = 'Income'), 0) AS "totalIncome",
        COALESCE(SUM("nominal") FILTER (WHERE "io"::text = 'Expenses'), 0) AS "totalExpenses"
      FROM "Entry"
    `,
    prisma.$queryRaw<SummaryCategoryRow[]>`
      SELECT
        c."name" AS "category",
        COALESCE(SUM(e."nominal"), 0) AS "total",
        COALESCE(SUM(e."nominal") FILTER (WHERE e."io"::text = 'Expenses'), 0) AS "expenseTotal",
        COUNT(*) FILTER (WHERE e."io"::text = 'Expenses') AS "expenseCount"
      FROM "Entry" e
      INNER JOIN "Category" c ON c."id" = e."categoryId"
      GROUP BY c."name"
    `,
    prisma.$queryRaw<SummaryDayRow[]>`
      SELECT "date", "io"::text AS "io", COALESCE(SUM("nominal"), 0) AS "total"
      FROM "Entry"
      WHERE "date" IS NOT NULL
      GROUP BY "date", "io"
    `,
  ]);

  const summaryRow = summaryRows[0] || { totalEntries: 0, totalIncome: 0, totalExpenses: 0 };

  const categoryMap = new Map<string, { total: number; count: number }>();
  const weeklyMap = new Map<string, { income: number; expenses: number }>();
  const monthlyMap = new Map<string, { income: number; expenses: number }>();

  const summary: Omit<CashflowSummary, "currentWeek" | "currentMonth" | "topExpenseCategories" | "weeklyBreakdown"> = {
    totalEntries: toNumber(summaryRow.totalEntries),
    totalIncome: toNumber(summaryRow.totalIncome),
    totalExpenses: toNumber(summaryRow.totalExpenses),
    balance: 0,
    byCategory: {},
    byIO: {
      Income: toNumber(summaryRow.totalIncome),
      Expenses: toNumber(summaryRow.totalExpenses),
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

export async function getEntries(options?: {
  pageSize?: number;
  skip?: number;
}): Promise<{ entries: CashflowEntry[]; nextCursor: string | null; hasMore: boolean }> {
  return getEntriesFiltered({ pageSize: options?.pageSize, skip: options?.skip });
}

export async function countEntries(): Promise<number> {
  return prisma.entry.count();
}

export async function countEntriesForDate(date: string): Promise<number> {
  return prisma.entry.count({ where: { date } });
}

export async function getEntriesFiltered(options?: {
  pageSize?: number;
  skip?: number;
  io?: IOType;
  date?: string;
}): Promise<{ entries: CashflowEntry[]; nextCursor: string | null; hasMore: boolean }> {
  const pageSize = options?.pageSize || 20;
  const skip = options?.skip || 0;
  const where = buildEntryWhere({ io: options?.io, date: options?.date });

  const entries = await prisma.entry.findMany({
    where,
    include: { category: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    skip,
    take: pageSize + 1,
  });

  return {
    entries: entries.slice(0, pageSize).map(toEntry),
    nextCursor: null,
    hasMore: entries.length > pageSize,
  };
}

export async function getEntriesByIOPaginated(ioType: IOType, options?: {
  pageSize?: number;
  skip?: number;
}): Promise<{ entries: CashflowEntry[]; nextCursor: string | null; hasMore: boolean }> {
  return getEntriesFiltered({
    pageSize: options?.pageSize,
    skip: options?.skip,
    io: ioType,
  });
}

async function findCategory(name: CategoryType | undefined) {
  if (!name) return null;
  return prisma.category.findUnique({ where: { name } });
}

export async function createEntry(data: {
  name: string;
  nominal: number;
  category?: CategoryType;
  date?: string;
  io?: IOType;
}): Promise<CashflowEntry> {
  if (data.io === "Expenses" && !data.category) {
    throw new Error("Category is required for expenses");
  }

  const category = await findCategory(data.category);
  if (data.category && !category) {
    throw new Error(`Category "${data.category}" not found`);
  }

  const entry = await prisma.entry.create({
    data: {
      name: data.name,
      nominal: data.nominal,
      categoryId: category?.id ?? null,
      date: data.date ?? null,
      io: data.io ?? null,
    },
    include: { category: true },
  });

  return toEntry(entry);
}

export async function updateEntry(
  entryId: string,
  data: Partial<{
    name: string;
    nominal: number;
    category: CategoryType;
    date: string;
    io: IOType;
  }>
): Promise<CashflowEntry> {
  const category = data.category === undefined ? undefined : await findCategory(data.category);
  if (data.category && !category) {
    throw new Error(`Category "${data.category}" not found`);
  }

  const entry = await prisma.entry.update({
    where: { id: entryId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.nominal !== undefined ? { nominal: data.nominal } : {}),
      ...(data.category !== undefined ? { categoryId: category?.id ?? null } : {}),
      ...(data.date !== undefined ? { date: data.date } : {}),
      ...(data.io !== undefined ? { io: data.io } : {}),
    },
    include: { category: true },
  });

  return toEntry(entry);
}

export async function deleteEntry(entryId: string): Promise<void> {
  await prisma.entry.delete({ where: { id: entryId } });
}

export async function getCategoryOptions(): Promise<CategoryOptionWithColor[]> {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon ?? null,
  }));
}

export async function getCategoryOptionsWithUsage(): Promise<CategoryOptionWithUsage[]> {
  const [categories, usageCounts] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.entry.groupBy({
      by: ["categoryId"],
      where: { categoryId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const usageByCategoryId = new Map(
    usageCounts.map((usage) => [usage.categoryId, usage._count._all])
  );

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon ?? null,
    usageCount: usageByCategoryId.get(category.id) || 0,
  }));
}

export async function addCategoryOption(name: string, color?: string, icon?: string): Promise<CategoryOptionWithColor[]> {
  try {
    await prisma.category.create({ data: { name, color: color || "default", icon: icon ?? null } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(`Category "${name}" already exists`);
    }
    throw error;
  }

  return getCategoryOptions();
}

export async function updateCategoryOption(
  categoryId: string,
  data: { name?: string; color?: string; icon?: string | null },
): Promise<CategoryOptionWithColor[]> {
  const updateData: Record<string, string | null> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.icon !== undefined) updateData.icon = data.icon;

  try {
    await prisma.category.update({ where: { id: categoryId }, data: updateData });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(`Category name "${data.name}" already exists`);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new Error(`Category with ID "${categoryId}" not found`);
    }
    throw error;
  }

  return getCategoryOptions();
}

export async function removeCategoryOption(categoryId: string): Promise<CategoryOptionWithColor[]> {
  try {
    await prisma.category.delete({ where: { id: categoryId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new Error(`Category with ID "${categoryId}" not found`);
    }
    throw error;
  }

  return getCategoryOptions();
}

export async function getCategoryUsageCount(categoryName: string): Promise<number> {
  return prisma.entry.count({ where: { category: { is: { name: categoryName } } } });
}

export interface QuickFillPreset {
  id: string;
  name: string;
  nominal: number;
  category: string | null;
  categoryId: string | null;
}

export async function getQuickFills(): Promise<QuickFillPreset[]> {
  const presets = await prisma.quickFill.findMany({
    include: { category: true },
    orderBy: { order: "asc" },
  });
  return presets.map((p) => ({
    id: p.id,
    name: p.name,
    nominal: p.nominal,
    category: p.category?.name ?? null,
    categoryId: p.categoryId,
  }));
}

export async function createQuickFill(data: {
  name: string;
  nominal: number;
  categoryId?: string | null;
}): Promise<QuickFillPreset> {
  const maxOrder = await prisma.quickFill.aggregate({ _max: { order: true } });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const preset = await prisma.quickFill.create({
    data: {
      name: data.name,
      nominal: data.nominal,
      categoryId: data.categoryId ?? null,
      order: nextOrder,
    },
    include: { category: true },
  });
  return {
    id: preset.id,
    name: preset.name,
    nominal: preset.nominal,
    category: preset.category?.name ?? null,
    categoryId: preset.categoryId,
  };
}

export async function updateQuickFill(id: string, data: { name?: string; nominal?: number; categoryId?: string | null }): Promise<QuickFillPreset> {
  const preset = await prisma.quickFill.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.nominal !== undefined && { nominal: data.nominal }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
    },
    include: { category: true },
  });
  return {
    id: preset.id,
    name: preset.name,
    nominal: preset.nominal,
    category: preset.category?.name ?? null,
    categoryId: preset.categoryId,
  };
}

export async function deleteQuickFill(id: string): Promise<void> {
  await prisma.quickFill.delete({ where: { id } });
}
