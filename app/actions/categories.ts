"use server";

import {
  getCategoryOptions,
  getCategoryOptionsWithUsage,
  addCategoryOption,
  updateCategoryOption,
  removeCategoryOption,
  getCategoryUsageCount,
  type CategoryOptionWithColor,
} from "@/lib/db";
import type { CategoryType } from "@/lib/db";
import { getCurrentManagementId } from "@/lib/management";

export type CategoryWithUsage = CategoryOptionWithColor & {
  usageCount: number;
};

export async function fetchCategories(): Promise<CategoryType[]> {
  const managementId = await getCurrentManagementId();
  const options = await getCategoryOptions(managementId);
  return options.map((opt) => opt.name);
}

export async function fetchCategoriesWithDetails(): Promise<CategoryWithUsage[]> {
  const managementId = await getCurrentManagementId();
  return getCategoryOptionsWithUsage(managementId);
}

export async function createCategory(name: string, color?: string, icon?: string, budgets?: { budgetDaily?: number | null; budgetWeekly?: number | null; budgetMonthly?: number | null }): Promise<CategoryOptionWithColor[]> {
  const managementId = await getCurrentManagementId();
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Category name cannot be empty");
  }

  return addCategoryOption(trimmedName, color ?? "default", icon, managementId, budgets);
}

export async function updateCategory(
  categoryId: string,
  data: { name?: string; color?: string; icon?: string | null; budgetDaily?: number | null; budgetWeekly?: number | null; budgetMonthly?: number | null },
): Promise<CategoryOptionWithColor[]> {
  const managementId = await getCurrentManagementId();
  if (data.name !== undefined) {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error("Category name cannot be empty");
    }
    data.name = trimmedName;
  }
  return updateCategoryOption(categoryId, data, managementId);
}

export async function deleteCategory(categoryId: string): Promise<{ success: boolean; usageCount?: number }> {
  const managementId = await getCurrentManagementId();
  const options = await getCategoryOptions(managementId);
  const category = options.find((opt) => opt.id === categoryId);

  if (!category) {
    throw new Error("Category not found");
  }

  const usageCount = await getCategoryUsageCount(category.name, managementId);

  if (usageCount > 0) {
    return { success: false, usageCount };
  }

  await removeCategoryOption(categoryId, managementId);
  return { success: true };
}

export async function checkCategoryUsage(categoryName: string): Promise<number> {
  const managementId = await getCurrentManagementId();
  return getCategoryUsageCount(categoryName, managementId);
}
