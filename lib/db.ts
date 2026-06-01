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
  budgetDaily: number | null;
  budgetWeekly: number | null;
  budgetMonthly: number | null;
  budgetYearly: number | null;
}

export type CategoryOptionWithUsage = CategoryOptionWithColor & {
  usageCount: number;
};

export type BudgetPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface OverallBudgetOption {
  id: string;
  period: BudgetPeriod;
  amount: number;
}

export interface BudgetStatusItem {
  type: "category" | "overall";
  id: string;
  name: string;
  period: BudgetPeriod;
  budgetAmount: number;
  spent: number;
  remaining: number;
  percentage: number;
  isWarning: boolean;
  isOverBudget: boolean;
}

type EntryWithCategory = Prisma.EntryGetPayload<{
  include: { category: true };
}>;

export type EntryWhereInput = Prisma.EntryWhereInput;

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

export async function getAllEntries(managementId: string): Promise<CashflowEntry[]> {
  const entries = await prisma.entry.findMany({
    where: { managementId },
    include: { category: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return entries.map(toEntry);
}

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
    prisma.entry.count({ where: { managementId } }),
    prisma.entry.aggregate({ where: { managementId, io: "Income" }, _sum: { nominal: true } }),
    prisma.entry.aggregate({ where: { managementId, io: "Expenses" }, _sum: { nominal: true } }),
    prisma.$queryRaw<SummaryCategoryRow[]>`
      SELECT
        c."name" AS "category",
        COALESCE(SUM(e."nominal"), 0) AS "total",
        COALESCE(SUM(e."nominal") FILTER (WHERE e."io"::text = 'Expenses'), 0) AS "expenseTotal",
        COUNT(*) FILTER (WHERE e."io"::text = 'Expenses') AS "expenseCount"
      FROM "Entry" e
      INNER JOIN "Category" c ON c."id" = e."categoryId"
      WHERE e."managementId" = ${managementId} AND e."date" >= ${categoryWindow}
      GROUP BY c."name"
    `,
    prisma.$queryRaw<SummaryDayRow[]>`
      SELECT "date", "io"::text AS "io", COALESCE(SUM("nominal"), 0) AS "total"
      FROM "Entry"
      WHERE "date" IS NOT NULL AND "managementId" = ${managementId} AND "date" >= ${dayWindow}
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

export async function getEntries(options?: {
  pageSize?: number;
  skip?: number;
  managementId: string;
}): Promise<{ entries: CashflowEntry[]; nextCursor: string | null; hasMore: boolean }> {
  return getEntriesFiltered({ pageSize: options?.pageSize, skip: options?.skip, managementId: options!.managementId });
}

export async function countEntries(managementId: string): Promise<number> {
  return prisma.entry.count({ where: { managementId } });
}

export async function countEntriesForDate(date: string, managementId: string): Promise<number> {
  return prisma.entry.count({ where: { date, managementId } });
}

export async function getEntriesFiltered(options?: {
  pageSize?: number;
  skip?: number;
  io?: IOType;
  date?: string;
  managementId: string;
}): Promise<{ entries: CashflowEntry[]; nextCursor: string | null; hasMore: boolean }> {
  const pageSize = options?.pageSize || 20;
  const skip = options?.skip || 0;
  const where = {
    managementId: options!.managementId,
    ...buildEntryWhere({ io: options?.io, date: options?.date }),
  };

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
  managementId: string;
}): Promise<{ entries: CashflowEntry[]; nextCursor: string | null; hasMore: boolean }> {
  return getEntriesFiltered({
    pageSize: options?.pageSize,
    skip: options?.skip,
    io: ioType,
    managementId: options!.managementId,
  });
}

async function findCategory(name: CategoryType | undefined, managementId: string) {
  if (!name) return null;
  return prisma.category.findFirst({ where: { name, managementId } });
}

export async function createEntry(data: {
  name: string;
  nominal: number;
  category?: CategoryType;
  date?: string;
  io?: IOType;
  managementId: string;
  userId?: string;
}): Promise<CashflowEntry> {
  const category = await findCategory(data.category, data.managementId);
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
      managementId: data.managementId,
      createdById: data.userId ?? null,
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
    managementId: string;
  }>
): Promise<CashflowEntry> {
  const category = data.category === undefined ? undefined : await findCategory(data.category, data.managementId || "");
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

const DEFAULT_CATEGORIES = [
  { name: "Makanan", color: "orange", icon: "CookieIcon" },
  { name: "Transportasi", color: "blue", icon: "Bus01Icon" },
  { name: "Belanja", color: "green", icon: "ShoppingCart01Icon" },
  { name: "Tagihan", color: "red", icon: "Invoice01Icon" },
  { name: "Hiburan", color: "purple", icon: "GameController01Icon" },
  { name: "Kesehatan", color: "pink", icon: "HealthIcon" },
  { name: "Penyesuaian", color: "gray", icon: "Audit01Icon" },
  { name: "Lainnya", color: "gray", icon: "More01Icon" },
];

export async function ensureDefaultCategories(managementId: string): Promise<void> {
  const count = await prisma.category.count({ where: { managementId } });
  if (count > 0) return;

  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((cat) => ({
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      managementId,
    })),
  });
}

export async function getCategoryOptions(managementId: string): Promise<CategoryOptionWithColor[]> {
  await ensureDefaultCategories(managementId);
  const categories = await prisma.category.findMany({
    where: { managementId },
    orderBy: [{ name: "asc" }],
  });
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon ?? null,
    budgetDaily: category.budgetDaily,
    budgetWeekly: category.budgetWeekly,
    budgetMonthly: category.budgetMonthly,
    budgetYearly: category.budgetYearly,
  }));
}

export async function getCategoryOptionsWithUsage(managementId: string): Promise<CategoryOptionWithUsage[]> {
  await ensureDefaultCategories(managementId);
  const [categories, usageCounts] = await Promise.all([
    prisma.category.findMany({
      where: { managementId },
      orderBy: { name: "asc" },
    }),
    prisma.entry.groupBy({
      by: ["categoryId"],
      where: { categoryId: { not: null }, managementId },
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
    budgetDaily: category.budgetDaily,
    budgetWeekly: category.budgetWeekly,
    budgetMonthly: category.budgetMonthly,
    budgetYearly: category.budgetYearly,
    usageCount: usageByCategoryId.get(category.id) || 0,
  }));
}

export async function addCategoryOption(name: string, color?: string, icon?: string, managementId?: string, budgets?: { budgetDaily?: number | null; budgetWeekly?: number | null; budgetMonthly?: number | null; budgetYearly?: number | null }): Promise<CategoryOptionWithColor[]> {
  if (!managementId) throw new Error("managementId required");
  try {
    await prisma.category.create({
      data: {
        name,
        color: color || "default",
        icon: icon ?? null,
        managementId,
        budgetDaily: budgets?.budgetDaily ?? null,
        budgetWeekly: budgets?.budgetWeekly ?? null,
        budgetMonthly: budgets?.budgetMonthly ?? null,
        budgetYearly: budgets?.budgetYearly ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(`Category "${name}" already exists`);
    }
    throw error;
  }

  return getCategoryOptions(managementId);
}

export async function updateCategoryOption(
  categoryId: string,
  data: { name?: string; color?: string; icon?: string | null; budgetDaily?: number | null; budgetWeekly?: number | null; budgetMonthly?: number | null; budgetYearly?: number | null },
  managementId?: string,
): Promise<CategoryOptionWithColor[]> {
  const updateData: Record<string, string | number | null> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.budgetDaily !== undefined) updateData.budgetDaily = data.budgetDaily;
  if (data.budgetWeekly !== undefined) updateData.budgetWeekly = data.budgetWeekly;
  if (data.budgetMonthly !== undefined) updateData.budgetMonthly = data.budgetMonthly;
  if (data.budgetYearly !== undefined) updateData.budgetYearly = data.budgetYearly;

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

  if (managementId) return getCategoryOptions(managementId);
  throw new Error("managementId required");
}

export async function removeCategoryOption(categoryId: string, managementId?: string): Promise<CategoryOptionWithColor[]> {
  try {
    await prisma.category.delete({ where: { id: categoryId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new Error(`Category with ID "${categoryId}" not found`);
    }
    throw error;
  }

  if (managementId) return getCategoryOptions(managementId);
  throw new Error("managementId required");
}

export async function getCategoryUsageCount(categoryName: string, managementId: string): Promise<number> {
  return prisma.entry.count({ where: { category: { is: { name: categoryName } }, managementId } });
}

export interface QuickFillPreset {
  id: string;
  name: string;
  nominal: number;
  category: string | null;
  categoryId: string | null;
}

export async function getQuickFills(managementId: string): Promise<QuickFillPreset[]> {
  const presets = await prisma.quickFill.findMany({
    where: { managementId },
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
  managementId: string;
}): Promise<QuickFillPreset> {
  const maxOrder = await prisma.quickFill.aggregate({
    where: { managementId: data.managementId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const preset = await prisma.quickFill.create({
    data: {
      name: data.name,
      nominal: data.nominal,
      categoryId: data.categoryId ?? null,
      managementId: data.managementId,
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

// --- Overall Budget CRUD ---

export async function getOverallBudgets(managementId: string): Promise<OverallBudgetOption[]> {
  const budgets = await prisma.overallBudget.findMany({
    where: { managementId },
    orderBy: { period: "asc" },
  });
  return budgets.map((b) => ({
    id: b.id,
    period: b.period as BudgetPeriod,
    amount: b.amount,
  }));
}

export async function upsertOverallBudget(managementId: string, period: BudgetPeriod, amount: number): Promise<OverallBudgetOption> {
  const budget = await prisma.overallBudget.upsert({
    where: { managementId_period: { managementId, period } },
    update: { amount },
    create: { managementId, period, amount },
  });
  return { id: budget.id, period: budget.period as BudgetPeriod, amount: budget.amount };
}

export async function deleteOverallBudget(managementId: string, period: BudgetPeriod): Promise<void> {
  await prisma.overallBudget.deleteMany({ where: { managementId, period } });
}

// --- Budget Status ---

function getCurrentDateRange(period: BudgetPeriod): { start: string; end: string } {
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

  // monthly
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: formatDate(start), end: formatDate(end) };
}

export async function getBudgetStatus(managementId: string): Promise<BudgetStatusItem[]> {
  const [categories, overallBudgets] = await Promise.all([
    prisma.category.findMany({
      where: { managementId },
      orderBy: { name: "asc" },
    }),
    prisma.overallBudget.findMany({ where: { managementId } }),
  ]);

  const periods: BudgetPeriod[] = ["daily", "weekly", "monthly", "yearly"];

  const periodResults = await Promise.all(
    periods.map(async (period) => {
      const results: BudgetStatusItem[] = [];
      const { start, end } = getCurrentDateRange(period);

      const overallBudget = overallBudgets.find((b) => b.period === period);
      if (overallBudget) {
        const overallSpent = await prisma.entry.aggregate({
          where: {
            managementId,
            io: "Expenses",
            date: { gte: start, lte: end },
          },
          _sum: { nominal: true },
        });
        const spent = overallSpent._sum.nominal ?? 0;
        const percentage = overallBudget.amount > 0 ? Math.round((spent / overallBudget.amount) * 100) : 0;
        results.push({
          type: "overall",
          id: overallBudget.id,
          name: "Total",
          period,
          budgetAmount: overallBudget.amount,
          spent,
          remaining: Math.max(0, overallBudget.amount - spent),
          percentage,
          isWarning: percentage >= 80 && percentage < 100,
          isOverBudget: percentage >= 100,
        });
      }

      const budgetField = period === "daily" ? "budgetDaily" as const : period === "weekly" ? "budgetWeekly" as const : period === "monthly" ? "budgetMonthly" as const : "budgetYearly" as const;
      const categoriesWithBudget = categories.filter((c) => c[budgetField] != null);

      if (categoriesWithBudget.length > 0) {
        const categoryIds = categoriesWithBudget.map((c) => c.id);
        const categorySpending = await prisma.entry.groupBy({
          by: ["categoryId"],
          where: {
            managementId,
            io: "Expenses",
            categoryId: { in: categoryIds },
            date: { gte: start, lte: end },
          },
          _sum: { nominal: true },
        });

        const spendingMap = new Map(
          categorySpending.map((s) => [s.categoryId, s._sum.nominal ?? 0])
        );

        for (const category of categoriesWithBudget) {
          const budgetAmount = category[budgetField]!;
          const spent = spendingMap.get(category.id) ?? 0;
          const percentage = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;
          results.push({
            type: "category",
            id: category.id,
            name: category.name,
            period,
            budgetAmount,
            spent,
            remaining: Math.max(0, budgetAmount - spent),
            percentage,
            isWarning: percentage >= 80 && percentage < 100,
            isOverBudget: percentage >= 100,
          });
        }
      }

      return results;
    })
  );

  return periodResults.flat();
}

// --- Recurring Entry CRUD ---

export interface RecurringEntryData {
  id: string;
  name: string;
  nominal: number;
  categoryId: string | null;
  categoryName: string | null;
  io: IOType;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  startDate: string;
  endDate: string | null;
  lastGenerated: string | null;
  active: boolean;
}

export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

export async function getRecurringEntries(managementId: string): Promise<RecurringEntryData[]> {
  const entries = await prisma.recurringEntry.findMany({
    where: { managementId },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
  return entries.map((e) => ({
    id: e.id,
    name: e.name,
    nominal: e.nominal,
    categoryId: e.categoryId,
    categoryName: e.category?.name ?? null,
    io: e.io as IOType,
    frequency: e.frequency,
    dayOfWeek: e.dayOfWeek,
    dayOfMonth: e.dayOfMonth,
    monthOfYear: e.monthOfYear,
    startDate: e.startDate,
    endDate: e.endDate,
    lastGenerated: e.lastGenerated,
    active: e.active,
  }));
}

export async function createRecurringEntry(data: {
  managementId: string;
  name: string;
  nominal: number;
  categoryId?: string | null;
  io: IOType;
  frequency: RecurringFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  startDate: string;
  endDate?: string | null;
}): Promise<RecurringEntryData> {
  const entry = await prisma.recurringEntry.create({
    data: {
      managementId: data.managementId,
      name: data.name,
      nominal: data.nominal,
      categoryId: data.categoryId ?? null,
      io: data.io,
      frequency: data.frequency,
      dayOfWeek: data.dayOfWeek ?? null,
      dayOfMonth: data.dayOfMonth ?? null,
      monthOfYear: data.monthOfYear ?? null,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
    },
    include: { category: true },
  });
  return {
    id: entry.id,
    name: entry.name,
    nominal: entry.nominal,
    categoryId: entry.categoryId,
    categoryName: entry.category?.name ?? null,
    io: entry.io as IOType,
    frequency: entry.frequency,
    dayOfWeek: entry.dayOfWeek,
    dayOfMonth: entry.dayOfMonth,
    monthOfYear: entry.monthOfYear,
    startDate: entry.startDate,
    endDate: entry.endDate,
    lastGenerated: entry.lastGenerated,
    active: entry.active,
  };
}

export async function updateRecurringEntry(
  id: string,
  data: Partial<{
    name: string;
    nominal: number;
    categoryId: string | null;
    io: IOType;
    frequency: RecurringFrequency;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    monthOfYear: number | null;
    startDate: string;
    endDate: string | null;
    active: boolean;
  }>,
  managementId: string,
): Promise<RecurringEntryData> {
  const entry = await prisma.recurringEntry.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.nominal !== undefined && { nominal: data.nominal }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.io !== undefined && { io: data.io }),
      ...(data.frequency !== undefined && { frequency: data.frequency }),
      ...(data.dayOfWeek !== undefined && { dayOfWeek: data.dayOfWeek }),
      ...(data.dayOfMonth !== undefined && { dayOfMonth: data.dayOfMonth }),
      ...(data.monthOfYear !== undefined && { monthOfYear: data.monthOfYear }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
      ...(data.active !== undefined && { active: data.active }),
    },
    include: { category: true },
  });
  return {
    id: entry.id,
    name: entry.name,
    nominal: entry.nominal,
    categoryId: entry.categoryId,
    categoryName: entry.category?.name ?? null,
    io: entry.io as IOType,
    frequency: entry.frequency,
    dayOfWeek: entry.dayOfWeek,
    dayOfMonth: entry.dayOfMonth,
    monthOfYear: entry.monthOfYear,
    startDate: entry.startDate,
    endDate: entry.endDate,
    lastGenerated: entry.lastGenerated,
    active: entry.active,
  };
}

export async function deleteRecurringEntry(id: string, managementId: string): Promise<void> {
  await prisma.recurringEntry.deleteMany({ where: { id, managementId } });
}

// --- Recurring Entry Generation ---

function shouldGenerateToday(
  entry: { frequency: string; dayOfWeek: number | null; dayOfMonth: number | null; monthOfYear: number | null; startDate: string; endDate: string | null; lastGenerated: string | null },
  today: string,
): boolean {
  if (today < entry.startDate) return false;
  if (entry.endDate && today > entry.endDate) return false;
  if (entry.lastGenerated && entry.lastGenerated >= today) return false;

  const todayDate = new Date(today);
  const dayOfWeek = todayDate.getDay();
  const dayOfMonth = todayDate.getDate();
  const month = todayDate.getMonth() + 1;

  if (entry.frequency === "daily") return true;

  if (entry.frequency === "weekly") {
    return entry.dayOfWeek === dayOfWeek;
  }

  if (entry.frequency === "monthly") {
    return entry.dayOfMonth === dayOfMonth;
  }

  if (entry.frequency === "yearly") {
    return entry.monthOfYear === month && entry.dayOfMonth === dayOfMonth;
  }

  return false;
}

export interface CalendarDayData {
  entries: CashflowEntry[];
  income: number;
  expenses: number;
}

export async function getCalendarEntries(
  managementId: string,
  year: number,
  month: number,
  io?: IOType,
): Promise<Record<string, CalendarDayData>> {
  const firstDay = new Date(year, month, 1);
  const startOfWeek = new Date(firstDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const lastDay = new Date(year, month + 1, 0);
  const endOfWeek = new Date(lastDay);
  endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
  endOfWeek.setDate(endOfWeek.getDate() + 1);

  const startDate = formatDate(startOfWeek);
  const endDate = formatDate(endOfWeek);

  const where: EntryWhereInput = {
    managementId,
    ...buildEntryWhere({ io, startDate, endDate }),
  };

  const entries = await prisma.entry.findMany({
    where,
    include: { category: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const result: Record<string, CalendarDayData> = {};

  for (const entry of entries) {
    const dateKey = entry.date;
    if (!dateKey) continue;

    if (!result[dateKey]) {
      result[dateKey] = { entries: [], income: 0, expenses: 0 };
    }

    const mapped = toEntry(entry);
    result[dateKey].entries.push(mapped);

    if (entry.io === "Income") {
      result[dateKey].income += entry.nominal;
    } else if (entry.io === "Expenses") {
      result[dateKey].expenses += entry.nominal;
    }
  }

  return result;
}

export async function generateRecurringEntries(managementId: string): Promise<number> {
  const today = formatDate(new Date());
  const entries = await prisma.recurringEntry.findMany({
    where: { managementId, active: true },
    include: { category: true },
  });

  let generated = 0;

  for (const recurring of entries) {
    if (!shouldGenerateToday(recurring, today)) continue;

    await prisma.entry.create({
      data: {
        name: recurring.name,
        nominal: recurring.nominal,
        categoryId: recurring.categoryId,
        date: today,
        io: recurring.io,
        managementId,
      },
    });

    await prisma.recurringEntry.update({
      where: { id: recurring.id },
      data: { lastGenerated: today },
    });

    generated++;
  }

  return generated;
}

export interface AuditSnapshotData {
  id: string;
  date: string;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
  adjusted: boolean;
  note: string | null;
  createdAt: Date;
}

export async function getBalanceAsOf(managementId: string): Promise<number> {
  const [incomeAgg, expensesAgg] = await Promise.all([
    prisma.entry.aggregate({ where: { managementId, io: "Income" }, _sum: { nominal: true } }),
    prisma.entry.aggregate({ where: { managementId, io: "Expenses" }, _sum: { nominal: true } }),
  ]);

  const totalIncome = incomeAgg._sum.nominal ?? 0;
  const totalExpenses = expensesAgg._sum.nominal ?? 0;

  return totalIncome - totalExpenses;
}

async function getAdjustmentCategoryId(managementId: string): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { name: "Penyesuaian", managementId },
  });
  if (existing) return existing.id;

  const created = await prisma.category.create({
    data: { name: "Penyesuaian", color: "gray", icon: "Audit01Icon", managementId },
  });
  return created.id;
}

export async function createAuditSnapshot(params: {
  managementId: string;
  userId: string;
  actualBalance: number;
  note?: string;
  autoAdjust: boolean;
}): Promise<AuditSnapshotData> {
  const today = formatDate(new Date());
  const expectedBalance = await getBalanceAsOf(params.managementId);
  const difference = params.actualBalance - expectedBalance;

  let adjustmentEntryId: string | null = null;

  if (params.autoAdjust && Math.abs(difference) > 0.01) {
    const categoryId = await getAdjustmentCategoryId(params.managementId);
    const io: IOType = difference > 0 ? "Income" : "Expenses";

    const entry = await prisma.entry.create({
      data: {
        name: `Penyesuaian audit ${today}`,
        nominal: Math.abs(difference),
        categoryId,
        date: today,
        io,
        isReconciliation: true,
        managementId: params.managementId,
        createdById: params.userId,
      },
    });
    adjustmentEntryId = entry.id;
  }

  const snapshot = await prisma.auditSnapshot.create({
    data: {
      managementId: params.managementId,
      date: today,
      expectedBalance,
      actualBalance: params.actualBalance,
      difference,
      adjustmentEntryId,
      note: params.note ?? null,
      createdById: params.userId,
    },
  });

  return {
    id: snapshot.id,
    date: snapshot.date,
    expectedBalance: snapshot.expectedBalance,
    actualBalance: snapshot.actualBalance,
    difference: snapshot.difference,
    adjusted: adjustmentEntryId !== null,
    note: snapshot.note,
    createdAt: snapshot.createdAt,
  };
}

export async function getAuditHistory(managementId: string, limit = 5): Promise<AuditSnapshotData[]> {
  const snapshots = await prisma.auditSnapshot.findMany({
    where: { managementId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return snapshots.map((s) => ({
    id: s.id,
    date: s.date,
    expectedBalance: s.expectedBalance,
    actualBalance: s.actualBalance,
    difference: s.difference,
    adjusted: s.adjustmentEntryId !== null,
    note: s.note,
    createdAt: s.createdAt,
  }));
}

export async function getLatestAuditSnapshot(managementId: string): Promise<AuditSnapshotData | null> {
  const snapshot = await prisma.auditSnapshot.findFirst({
    where: { managementId },
    orderBy: { createdAt: "desc" },
  });

  if (!snapshot) return null;

  return {
    id: snapshot.id,
    date: snapshot.date,
    expectedBalance: snapshot.expectedBalance,
    actualBalance: snapshot.actualBalance,
    difference: snapshot.difference,
    adjusted: snapshot.adjustmentEntryId !== null,
    note: snapshot.note,
    createdAt: snapshot.createdAt,
  };
}
