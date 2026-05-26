"use server";

import {
  getCategoryOptions,
  addCategoryOption,
  removeCategoryOption,
  getCategoryUsageCount,
  type CategoryOptionWithColor,
} from "@/lib/notion";
import type { CategoryType } from "@/lib/notion";

export type CategoryWithUsage = CategoryOptionWithColor & {
  usageCount: number;
};

export async function fetchCategories(): Promise<CategoryType[]> {
  const options = await getCategoryOptions();
  return options.map((opt) => opt.name);
}

export async function fetchCategoriesWithDetails(): Promise<CategoryWithUsage[]> {
  const options = await getCategoryOptions();
  
  const usageCounts = await Promise.all(
    options.map((opt) => getCategoryUsageCount(opt.name))
  );
  
  return options.map((opt, index) => ({
    ...opt,
    usageCount: usageCounts[index],
  }));
}

export async function createCategory(name: string): Promise<CategoryOptionWithColor[]> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Category name cannot be empty");
  }
  
  return addCategoryOption(trimmedName);
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