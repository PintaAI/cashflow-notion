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
  deleteCategory,
} from "@/app/actions/categories";

export const cashflowQueryKeys = {
  entries: ["cashflow-entries"] as const,
  summary: ["cashflow-summary"] as const,
  activity: ["cashflow-activity"] as const,
  analytics: (filters: URLAnalyticsFilter) => ["cashflow-analytics", filters] as const,
  analyticsRoot: ["cashflow-analytics"] as const,
  categories: ["cashflow-categories"] as const,
  categoriesWithDetails: ["cashflow-categories-details"] as const,
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
    mutationFn: (name: string) => createCategory(name),
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
