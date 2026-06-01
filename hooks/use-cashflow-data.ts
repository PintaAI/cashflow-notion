"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { fetchSummary, fetchCalendarEntries } from "@/app/actions/cashflow";
import { fetchActivityOverview, fetchAnalyticsFromURL } from "@/app/actions/analytics";
import type { URLAnalyticsFilter } from "@/lib/analytics";
import {
  fetchCategories,
  fetchCategoriesWithDetails,
  createCategory,
  updateCategory as updateCategoryAction,
  deleteCategory,
} from "@/app/actions/categories";
import {
  fetchQuickFills,
  addQuickFill,
  editQuickFill,
  removeQuickFill,
} from "@/app/actions/quick-fill";
import {
  fetchBudgetStatus,
  saveOverallBudget,
  removeOverallBudget,
} from "@/app/actions/budgets";
import {
  fetchRecurringEntries,
  addRecurringEntry,
  editRecurringEntry,
  removeRecurringEntry,
  runRecurringGeneration,
} from "@/app/actions/recurring";
import {
  fetchBalance,
  fetchAuditHistory,
  fetchLatestAudit,
  performAudit,
} from "@/app/actions/audit";
import type { BudgetPeriod, RecurringFrequency, IOType } from "@/lib/db";

export const cashflowQueryKeys = {
  entries: ["cashflow-entries"] as const,
  summary: ["cashflow-summary"] as const,
  activity: ["cashflow-activity"] as const,
  analytics: (filters: URLAnalyticsFilter) => ["cashflow-analytics", filters] as const,
  analyticsRoot: ["cashflow-analytics"] as const,
  categories: ["cashflow-categories"] as const,
  categoriesWithDetails: ["cashflow-categories-details"] as const,
  quickFills: ["cashflow-quick-fills"] as const,
  budgetStatus: ["cashflow-budget-status"] as const,
  recurring: ["cashflow-recurring"] as const,
  balance: ["cashflow-balance"] as const,
  auditHistory: ["cashflow-audit-history"] as const,
  latestAudit: ["cashflow-latest-audit"] as const,
  calendarEntries: (year: number, month: number) => ["cashflow-calendar", year, month] as const,
};

const CATEGORY_STALE_TIME = 1000 * 60 * 30;

export function useSummary() {
  return useQuery({
    queryKey: cashflowQueryKeys.summary,
    queryFn: fetchSummary,
  });
}

export function useActivityOverview() {
  return useQuery({
    queryKey: cashflowQueryKeys.activity,
    queryFn: () => fetchActivityOverview(),
  });
}

export function useCalendarEntries(year: number, month: number) {
  return useQuery({
    queryKey: cashflowQueryKeys.calendarEntries(year, month),
    queryFn: () => fetchCalendarEntries(year, month),
  });
}

export function useAnalytics(filters: URLAnalyticsFilter) {
  return useQuery({
    queryKey: cashflowQueryKeys.analytics(filters),
    queryFn: () => fetchAnalyticsFromURL(filters),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: cashflowQueryKeys.categories,
    queryFn: fetchCategories,
    staleTime: CATEGORY_STALE_TIME,
  });
}

export function useCategoriesWithDetails() {
  return useQuery({
    queryKey: cashflowQueryKeys.categoriesWithDetails,
    queryFn: fetchCategoriesWithDetails,
    staleTime: CATEGORY_STALE_TIME,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ name, color, icon, budgets }: { name: string; color?: string; icon?: string; budgets?: { budgetDaily?: number | null; budgetWeekly?: number | null; budgetMonthly?: number | null; budgetYearly?: number | null } }) => createCategory(name, color ?? "default", icon, budgets),
    onSuccess: (newCategories) => {
      queryClient.setQueryData(cashflowQueryKeys.categories, newCategories.map((c) => c.name));
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.categoriesWithDetails });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.budgetStatus });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (categoryId: string) => deleteCategory(categoryId),
    onSuccess: async (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.categories });
        queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.categoriesWithDetails });
        queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.summary });
        queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.analyticsRoot });
        queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.budgetStatus });
      }
      return result;
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name, color, icon, budgetDaily, budgetWeekly, budgetMonthly, budgetYearly }: { id: string; name?: string; color?: string; icon?: string | null; budgetDaily?: number | null; budgetWeekly?: number | null; budgetMonthly?: number | null; budgetYearly?: number | null }) =>
      updateCategoryAction(id, { name, color, icon, budgetDaily, budgetWeekly, budgetMonthly, budgetYearly }),
    onSuccess: (newCategories) => {
      queryClient.setQueryData(cashflowQueryKeys.categories, newCategories.map((c) => c.name));
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.categoriesWithDetails });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.budgetStatus });
    },
  });
}

export function useQuickFills() {
  return useQuery({
    queryKey: cashflowQueryKeys.quickFills,
    queryFn: fetchQuickFills,
  });
}

export function useCreateQuickFill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; nominal: number; categoryId?: string | null }) => addQuickFill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.quickFills });
    },
  });
}

export function useUpdateQuickFill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; nominal?: number; categoryId?: string | null }) =>
      editQuickFill(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.quickFills });
    },
  });
}

export function useDeleteQuickFill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => removeQuickFill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.quickFills });
    },
  });
}

export function useBudgetStatus() {
  return useQuery({
    queryKey: cashflowQueryKeys.budgetStatus,
    queryFn: fetchBudgetStatus,
  });
}

export function useSaveOverallBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ period, amount }: { period: BudgetPeriod; amount: number }) => saveOverallBudget(period, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.budgetStatus });
    },
  });
}

export function useRemoveOverallBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (period: BudgetPeriod) => removeOverallBudget(period),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.budgetStatus });
    },
  });
}

export function useRecurringEntries() {
  return useQuery({
    queryKey: cashflowQueryKeys.recurring,
    queryFn: fetchRecurringEntries,
  });
}

export function useCreateRecurringEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
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
    }) => addRecurringEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.recurring });
    },
  });
}

export function useUpdateRecurringEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string;
      name?: string;
      nominal?: number;
      categoryId?: string | null;
      io?: IOType;
      frequency?: RecurringFrequency;
      dayOfWeek?: number | null;
      dayOfMonth?: number | null;
      monthOfYear?: number | null;
      startDate?: string;
      endDate?: string | null;
      active?: boolean;
    }) => editRecurringEntry(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.recurring });
    },
  });
}

export function useDeleteRecurringEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => removeRecurringEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.recurring });
    },
  });
}

export function useRunRecurringGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => runRecurringGeneration(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.entries });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.summary });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.budgetStatus });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.recurring });
    },
  });
}

export function useBalance() {
  return useQuery({
    queryKey: cashflowQueryKeys.balance,
    queryFn: fetchBalance,
  });
}

export function useAuditHistory() {
  return useQuery({
    queryKey: cashflowQueryKeys.auditHistory,
    queryFn: fetchAuditHistory,
  });
}

export function useLatestAudit() {
  return useQuery({
    queryKey: cashflowQueryKeys.latestAudit,
    queryFn: fetchLatestAudit,
  });
}

export function usePerformAudit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: performAudit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.balance });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.auditHistory });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.latestAudit });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.summary });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.entries });
    },
  });
}
