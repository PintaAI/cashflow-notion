import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import type { CategoryOptionWithColor, CategoryOptionWithUsage } from "@/lib/db/types";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";

export async function ensureDefaultCategories(managementId: string): Promise<void> {
  const count = await prisma.category.count({ where: { managementId } });
  if (count > 0) return;

  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((cat) => ({
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      managementId,
    })),
  });
}

export async function getCategoryOptions(managementId: string): Promise<CategoryOptionWithColor[]> {
  await ensureDefaultCategories(managementId);
  const categories = await prisma.category.findMany({
    where: { managementId },
    orderBy: [{ name: "asc" }],
  });
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon ?? null,
    budgetDaily: category.budgetDaily,
    budgetWeekly: category.budgetWeekly,
    budgetMonthly: category.budgetMonthly,
    budgetYearly: category.budgetYearly,
  }));
}

export async function getCategoryOptionsWithUsage(managementId: string): Promise<CategoryOptionWithUsage[]> {
  await ensureDefaultCategories(managementId);
  const [categories, usageCounts] = await Promise.all([
    prisma.category.findMany({
      where: { managementId },
      orderBy: { name: "asc" },
    }),
    prisma.entry.groupBy({
      by: ["categoryId"],
      where: { categoryId: { not: null }, managementId },
      _count: { _all: true },
    }),
  ]);
  const usageByCategoryId = new Map(
    usageCounts.map((usage) => [usage.categoryId, usage._count._all])
  );

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon ?? null,
    budgetDaily: category.budgetDaily,
    budgetWeekly: category.budgetWeekly,
    budgetMonthly: category.budgetMonthly,
    budgetYearly: category.budgetYearly,
    usageCount: usageByCategoryId.get(category.id) || 0,
  }));
}

export async function addCategoryOption(name: string, color?: string, icon?: string, managementId?: string, budgets?: { budgetDaily?: number | null; budgetWeekly?: number | null; budgetMonthly?: number | null; budgetYearly?: number | null }): Promise<CategoryOptionWithColor[]> {
  if (!managementId) throw new Error("managementId required");
  try {
    await prisma.category.create({
      data: {
        name,
        color: color || "default",
        icon: icon ?? null,
        managementId,
        budgetDaily: budgets?.budgetDaily ?? null,
        budgetWeekly: budgets?.budgetWeekly ?? null,
        budgetMonthly: budgets?.budgetMonthly ?? null,
        budgetYearly: budgets?.budgetYearly ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(`Category "${name}" already exists`);
    }
    throw error;
  }

  return getCategoryOptions(managementId);
}

export async function updateCategoryOption(
  categoryId: string,
  data: { name?: string; color?: string; icon?: string | null; budgetDaily?: number | null; budgetWeekly?: number | null; budgetMonthly?: number | null; budgetYearly?: number | null },
  managementId?: string,
): Promise<CategoryOptionWithColor[]> {
  const updateData: Record<string, string | number | null> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.budgetDaily !== undefined) updateData.budgetDaily = data.budgetDaily;
  if (data.budgetWeekly !== undefined) updateData.budgetWeekly = data.budgetWeekly;
  if (data.budgetMonthly !== undefined) updateData.budgetMonthly = data.budgetMonthly;
  if (data.budgetYearly !== undefined) updateData.budgetYearly = data.budgetYearly;

  try {
    await prisma.category.update({ where: { id: categoryId }, data: updateData });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(`Category name "${data.name}" already exists`);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new Error(`Category with ID "${categoryId}" not found`);
    }
    throw error;
  }

  if (managementId) return getCategoryOptions(managementId);
  throw new Error("managementId required");
}

export async function removeCategoryOption(categoryId: string, managementId?: string): Promise<CategoryOptionWithColor[]> {
  try {
    await prisma.category.delete({ where: { id: categoryId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new Error(`Category with ID "${categoryId}" not found`);
    }
    throw error;
  }

  if (managementId) return getCategoryOptions(managementId);
  throw new Error("managementId required");
}

export async function getCategoryUsageCount(categoryName: string, managementId: string): Promise<number> {
  return prisma.entry.count({ where: { category: { is: { name: categoryName } }, managementId } });
}
