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
import { resolveManagementId } from "@/lib/management";

export type CategoryWithUsage = CategoryOptionWithColor & {
  usageCount: number;
};

export async function fetchCategories(managementId?: string): Promise<CategoryType[]> {
  managementId = await resolveManagementId(managementId);
  const options = await getCategoryOptions(managementId);
  return options.map((opt) => opt.name);
}

export async function fetchCategoriesWithDetails(managementId?: string): Promise<CategoryWithUsage[]> {
  managementId = await resolveManagementId(managementId);
  return getCategoryOptionsWithUsage(managementId);
}

export async function createCategory(name: string, color?: string, icon?: string, budgets?: { budgetDaily?: number | null; budgetWeekly?: number | null; budgetMonthly?: number | null; budgetYearly?: number | null }, managementId?: string, clientId?: string): Promise<CategoryOptionWithColor[]> {
  managementId = await resolveManagementId(managementId);
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Category name cannot be empty");
  }

  if (clientId) {
    const existing = await getCategoryOptionsWithUsage(managementId);
    if (existing.some((category) => category.id === clientId)) return existing;
  }

  return addCategoryOption(trimmedName, color ?? "default", icon, managementId, budgets, clientId);
}

export async function updateCategory(
  categoryId: string,
  data: { name?: string; color?: string; icon?: string | null; budgetDaily?: number | null; budgetWeekly?: number | null; budgetMonthly?: number | null; budgetYearly?: number | null; managementId?: string },
): Promise<CategoryOptionWithColor[]> {
  const managementId = await resolveManagementId(data.managementId);
  const categoryData: Omit<typeof data, "managementId"> = {
    name: data.name,
    color: data.color,
    icon: data.icon,
    budgetDaily: data.budgetDaily,
    budgetWeekly: data.budgetWeekly,
    budgetMonthly: data.budgetMonthly,
    budgetYearly: data.budgetYearly,
  };
  if (data.name !== undefined) {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error("Category name cannot be empty");
    }
    categoryData.name = trimmedName;
  }
  return updateCategoryOption(categoryId, categoryData, managementId);
}

export async function deleteCategory(categoryId: string, managementId?: string): Promise<{ success: boolean; usageCount?: number }> {
  managementId = await resolveManagementId(managementId);
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

export async function checkCategoryUsage(categoryName: string, managementId?: string): Promise<number> {
  managementId = await resolveManagementId(managementId);
  return getCategoryUsageCount(categoryName, managementId);
}
