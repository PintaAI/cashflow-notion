import type { IOType as PrismaIOType, Prisma } from "@prisma/client";

export type IOType = PrismaIOType;
export type CategoryType = string;
export type EntryWhereInput = Prisma.EntryWhereInput;

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
  createdById: string | null;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
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

export interface QuickFillPreset {
  id: string;
  name: string;
  nominal: number;
  category: string | null;
  categoryId: string | null;
}

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

export interface CalendarDayData {
  entries: CashflowEntry[];
  income: number;
  expenses: number;
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

export type EntryWithCategory = Prisma.EntryGetPayload<{ include: { category: true } }>;

export type EntryForMapping = EntryWithCategory & {
  createdById: string | null;
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
};
