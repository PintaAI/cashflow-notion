export { prisma } from "@/lib/db/client";

export type {
  AuditSnapshotData,
  BudgetPeriod,
  BudgetStatusItem,
  CalendarDayData,
  CashflowEntry,
  CashflowProperty,
  CashflowSummary,
  CategoryOptionWithColor,
  CategoryOptionWithUsage,
  CategorySpend,
  CategoryType,
  EntryWhereInput,
  IOType,
  MonthlyStats,
  OverallBudgetOption,
  QuickFillPreset,
  RecurringEntryData,
  RecurringFrequency,
  WeeklyStats,
} from "@/lib/db/types";

export {
  buildEntryWhere,
  countEntries,
  countEntriesForDate,
  createEntry,
  deleteEntry,
  getAllEntries,
  getCalendarEntries,
  getEntries,
  getEntriesByIOPaginated,
  getEntriesFiltered,
  updateEntry,
} from "@/lib/db/entries";

export { getSummary } from "@/lib/db/summary";

export {
  addCategoryOption,
  ensureDefaultCategories,
  getCategoryOptions,
  getCategoryOptionsWithUsage,
  getCategoryUsageCount,
  removeCategoryOption,
  updateCategoryOption,
} from "@/lib/db/categories";

export {
  createQuickFill,
  deleteQuickFill,
  getQuickFills,
  updateQuickFill,
} from "@/lib/db/quick-fills";

export {
  deleteOverallBudget,
  getBudgetStatus,
  getOverallBudgets,
  upsertOverallBudget,
} from "@/lib/db/budgets";

export {
  createRecurringEntry,
  deleteRecurringEntry,
  generateRecurringEntries,
  getRecurringEntries,
  updateRecurringEntry,
} from "@/lib/db/recurring";

export {
  createAuditSnapshot,
  getAuditHistory,
  getBalanceAsOf,
  getLatestAuditSnapshot,
} from "@/lib/db/audit";
