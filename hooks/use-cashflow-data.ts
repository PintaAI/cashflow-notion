"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { fetchSummary } from "@/app/actions/cashflow";
import {
  fetchActivityOverview,
  fetchAnalyticsFromURL,
  type URLAnalyticsFilter,
} from "@/app/actions/analytics";
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
  removeQuickFill,
} from "@/app/actions/quick-fill";

export const cashflowQueryKeys = {
  entries: ["cashflow-entries"] as const,
  summary: ["cashflow-summary"] as const,
  activity: ["cashflow-activity"] as const,
  analytics: (filters: URLAnalyticsFilter) => ["cashflow-analytics", filters] as const,
  analyticsRoot: ["cashflow-analytics"] as const,
  categories: ["cashflow-categories"] as const,
  categoriesWithDetails: ["cashflow-categories-details"] as const,
  quickFills: ["cashflow-quick-fills"] as const,
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
    mutationFn: ({ name, color, icon }: { name: string; color?: string; icon?: string }) => createCategory(name, color ?? "default", icon),
    onSuccess: (newCategories) => {
      queryClient.setQueryData(cashflowQueryKeys.categories, newCategories.map((c) => c.name));
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.categoriesWithDetails });
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
      }
      return result;
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name, color, icon }: { id: string; name?: string; color?: string; icon?: string | null }) =>
      updateCategoryAction(id, { name, color, icon }),
    onSuccess: (newCategories) => {
      queryClient.setQueryData(cashflowQueryKeys.categories, newCategories.map((c) => c.name));
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.categoriesWithDetails });
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

export function useDeleteQuickFill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => removeQuickFill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.quickFills });
    },
  });
}
