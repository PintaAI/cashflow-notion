"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { fetchSummary, fetchCalendarEntries, fetchCategoryEntries } from "@/app/actions/cashflow";
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
import { getCurrentManagement } from "@/app/actions/management";
import { useManagement } from "@/components/providers/management-provider";
import type { BudgetPeriod, RecurringFrequency, IOType } from "@/lib/db";

export const cashflowQueryKeys = {
  scope: (managementId: string) => ["management", managementId] as const,
  entries: (managementId: string) => ["management", managementId, "cashflow-entries"] as const,
  summary: (managementId: string) => ["management", managementId, "cashflow-summary"] as const,
  activity: (managementId: string) => ["management", managementId, "cashflow-activity"] as const,
  analytics: (managementId: string, filters: URLAnalyticsFilter) => ["management", managementId, "cashflow-analytics", filters] as const,
  analyticsRoot: (managementId: string) => ["management", managementId, "cashflow-analytics"] as const,
  categories: (managementId: string) => ["management", managementId, "cashflow-categories"] as const,
  categoriesWithDetails: (managementId: string) => ["management", managementId, "cashflow-categories-details"] as const,
  quickFills: (managementId: string) => ["management", managementId, "cashflow-quick-fills"] as const,
  budgetStatus: (managementId: string) => ["management", managementId, "cashflow-budget-status"] as const,
  recurring: (managementId: string) => ["management", managementId, "cashflow-recurring"] as const,
  balance: (managementId: string) => ["management", managementId, "cashflow-balance"] as const,
  auditHistory: (managementId: string) => ["management", managementId, "cashflow-audit-history"] as const,
  latestAudit: (managementId: string) => ["management", managementId, "cashflow-latest-audit"] as const,
  managementMembers: (managementId: string) => ["management", managementId, "cashflow-management-members"] as const,
  calendarEntries: (managementId: string, year: number, month: number) => ["management", managementId, "cashflow-calendar", year, month] as const,
  categoryEntries: (managementId: string, category: string, from?: string, to?: string) => ["management", managementId, "cashflow-category-entries", category, from, to] as const,
};

export function invalidateActiveManagementQueries(queryClient: QueryClient, managementId: string) {
  const queryKeys: QueryKey[] = [
    cashflowQueryKeys.scope(managementId),
  ];

  for (const queryKey of queryKeys) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

const CATEGORY_STALE_TIME = 1000 * 60 * 30;

export function useSummary() {
  const { managementId } = useManagement();
  return useQuery({
    queryKey: cashflowQueryKeys.summary(managementId),
    queryFn: () => fetchSummary(managementId),
  });
}

export function useActivityOverview() {
  const { managementId } = useManagement();
  return useQuery({
    queryKey: cashflowQueryKeys.activity(managementId),
    queryFn: () => fetchActivityOverview(182, managementId),
  });
}

export function useCalendarEntries(year: number, month: number) {
  const { managementId } = useManagement();
  return useQuery({
    queryKey: cashflowQueryKeys.calendarEntries(managementId, year, month),
    queryFn: () => fetchCalendarEntries(year, month, undefined, managementId),
  });
}

export function useCategoryEntries(category: string, filters?: { from?: string; to?: string }) {
  const { managementId } = useManagement();
  return useQuery({
    queryKey: cashflowQueryKeys.categoryEntries(managementId, category, filters?.from, filters?.to),
    queryFn: () => fetchCategoryEntries(category, { managementId, from: filters?.from, to: filters?.to }),
    enabled: Boolean(category),
  });
}

export function useAnalytics(filters: URLAnalyticsFilter) {
  const { managementId } = useManagement();
  return useQuery({
    queryKey: cashflowQueryKeys.analytics(managementId, filters),
    queryFn: () => fetchAnalyticsFromURL(filters, managementId),
  });
}

export function useCategories() {
  const { managementId } = useManagement();
  return useQuery({
    queryKey: cashflowQueryKeys.categories(managementId),
    queryFn: () => fetchCategories(managementId),
    staleTime: CATEGORY_STALE_TIME,
  });
}

export function useManagementMembers() {
  const { managementId } = useManagement();
  return useQuery({
    queryKey: cashflowQueryKeys.managementMembers(managementId),
    queryFn: async () => {
      const management = await getCurrentManagement(managementId);
      return management?.management.members ?? [];
    },
  });
}

export function useCategoriesWithDetails() {
  const { managementId } = useManagement();
  return useQuery({
    queryKey: cashflowQueryKeys.categoriesWithDetails(managementId),
    queryFn: () => fetchCategoriesWithDetails(managementId),
    staleTime: CATEGORY_STALE_TIME,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();
  
  return useMutation({
    mutationFn: ({ name, color, icon, budgets }: { name: string; color?: string; icon?: string; budgets?: { budgetDaily?: number | null; budgetWeekly?: number | null; budgetMonthly?: number | null; budgetYearly?: number | null } }) => createCategory(name, color ?? "default", icon, budgets, managementId),
    onSuccess: (newCategories) => {
      queryClient.setQueryData(cashflowQueryKeys.categories(managementId), newCategories.map((c) => c.name));
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.categoriesWithDetails(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.budgetStatus(managementId) });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();
  
  return useMutation({
    mutationFn: (categoryId: string) => deleteCategory(categoryId, managementId),
    onSuccess: async (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.categories(managementId) });
        queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.categoriesWithDetails(managementId) });
        queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.summary(managementId) });
        queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.analyticsRoot(managementId) });
        queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.budgetStatus(managementId) });
      }
      return result;
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();

  return useMutation({
    mutationFn: ({ id, name, color, icon, budgetDaily, budgetWeekly, budgetMonthly, budgetYearly }: { id: string; name?: string; color?: string; icon?: string | null; budgetDaily?: number | null; budgetWeekly?: number | null; budgetMonthly?: number | null; budgetYearly?: number | null }) =>
      updateCategoryAction(id, { name, color, icon, budgetDaily, budgetWeekly, budgetMonthly, budgetYearly, managementId }),
    onSuccess: (newCategories) => {
      queryClient.setQueryData(cashflowQueryKeys.categories(managementId), newCategories.map((c) => c.name));
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.categoriesWithDetails(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.budgetStatus(managementId) });
    },
  });
}

export function useQuickFills() {
  const { managementId } = useManagement();
  return useQuery({
    queryKey: cashflowQueryKeys.quickFills(managementId),
    queryFn: () => fetchQuickFills(managementId),
  });
}

export function useCreateQuickFill() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();

  return useMutation({
    mutationFn: (data: { name: string; nominal: number; categoryId?: string | null }) => addQuickFill({ ...data, managementId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.quickFills(managementId) });
    },
  });
}

export function useUpdateQuickFill() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; nominal?: number; categoryId?: string | null }) =>
      editQuickFill(id, { ...data, managementId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.quickFills(managementId) });
    },
  });
}

export function useDeleteQuickFill() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();

  return useMutation({
    mutationFn: (id: string) => removeQuickFill(id, managementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.quickFills(managementId) });
    },
  });
}

export function useBudgetStatus() {
  const { managementId } = useManagement();
  return useQuery({
    queryKey: cashflowQueryKeys.budgetStatus(managementId),
    queryFn: () => fetchBudgetStatus(managementId),
  });
}

export function useSaveOverallBudget() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();

  return useMutation({
    mutationFn: ({ period, amount }: { period: BudgetPeriod; amount: number }) => saveOverallBudget(period, amount, managementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.budgetStatus(managementId) });
    },
  });
}

export function useRemoveOverallBudget() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();

  return useMutation({
    mutationFn: (period: BudgetPeriod) => removeOverallBudget(period, managementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.budgetStatus(managementId) });
    },
  });
}

export function useRecurringEntries() {
  const { managementId } = useManagement();
  return useQuery({
    queryKey: cashflowQueryKeys.recurring(managementId),
    queryFn: () => fetchRecurringEntries(managementId),
  });
}

export function useCreateRecurringEntry() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();

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
    }) => addRecurringEntry({ ...data, managementId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.recurring(managementId) });
    },
  });
}

export function useUpdateRecurringEntry() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();

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
    }) => editRecurringEntry(id, { ...data, managementId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.recurring(managementId) });
    },
  });
}

export function useDeleteRecurringEntry() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();

  return useMutation({
    mutationFn: (id: string) => removeRecurringEntry(id, managementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.recurring(managementId) });
    },
  });
}

export function useRunRecurringGeneration() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();

  return useMutation({
    mutationFn: () => runRecurringGeneration(managementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.entries(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.summary(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.budgetStatus(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.recurring(managementId) });
    },
  });
}

export function useBalance() {
  const { managementId } = useManagement();
  return useQuery({
    queryKey: cashflowQueryKeys.balance(managementId),
    queryFn: () => fetchBalance(managementId),
  });
}

export function useAuditHistory() {
  const { managementId } = useManagement();
  return useQuery({
    queryKey: cashflowQueryKeys.auditHistory(managementId),
    queryFn: () => fetchAuditHistory(managementId),
  });
}

export function useLatestAudit() {
  const { managementId } = useManagement();
  return useQuery({
    queryKey: cashflowQueryKeys.latestAudit(managementId),
    queryFn: () => fetchLatestAudit(managementId),
  });
}

export function usePerformAudit() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();

  return useMutation({
    mutationFn: (params: { actualBalance: number; note?: string; autoAdjust: boolean }) => performAudit({ ...params, managementId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.balance(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.auditHistory(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.latestAudit(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.summary(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.entries(managementId) });
    },
  });
}
