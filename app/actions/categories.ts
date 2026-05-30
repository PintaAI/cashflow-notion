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

export type CategoryWithUsage = CategoryOptionWithColor & {
  usageCount: number;
};

export async function fetchCategories(): Promise<CategoryType[]> {
  const options = await getCategoryOptions();
  return options.map((opt) => opt.name);
}

export async function fetchCategoriesWithDetails(): Promise<CategoryWithUsage[]> {
  return getCategoryOptionsWithUsage();
}

export async function createCategory(name: string, color?: string, icon?: string): Promise<CategoryOptionWithColor[]> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Category name cannot be empty");
  }
  
  return addCategoryOption(trimmedName, color ?? "default", icon);
}

export async function updateCategory(
  categoryId: string,
  data: { name?: string; color?: string; icon?: string | null },
): Promise<CategoryOptionWithColor[]> {
  if (data.name !== undefined) {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error("Category name cannot be empty");
    }
    data.name = trimmedName;
  }
  return updateCategoryOption(categoryId, data);
}

export async function deleteCategory(categoryId: string): Promise<{ success: boolean; usageCount?: number }> {
  const options = await getCategoryOptions();
  const category = options.find((opt) => opt.id === categoryId);
  
  if (!category) {
    throw new Error("Category not found");
  }
  
  const usageCount = await getCategoryUsageCount(category.name);
  
  if (usageCount > 0) {
    return { success: false, usageCount };
  }
  
  await removeCategoryOption(categoryId);
  return { success: true };
}

export async function checkCategoryUsage(categoryName: string): Promise<number> {
  return getCategoryUsageCount(categoryName);
}
