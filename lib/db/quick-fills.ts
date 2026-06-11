import { prisma } from "@/lib/db/client";
import type { QuickFillPreset } from "@/lib/db/types";

async function assertCategoryBelongsToManagement(categoryId: string | null | undefined, managementId: string) {
  if (!categoryId) return;
  const category = await prisma.category.findFirst({
    where: { id: categoryId, managementId },
    select: { id: true },
  });
  if (!category) throw new Error("Category not found");
}

export async function getQuickFills(managementId: string): Promise<QuickFillPreset[]> {
  const presets = await prisma.quickFill.findMany({
    where: { managementId },
    include: { category: true },
    orderBy: { order: "asc" },
  });
  return presets.map((p) => ({
    id: p.id,
    name: p.name,
    nominal: p.nominal,
    category: p.category?.name ?? null,
    categoryId: p.categoryId,
  }));
}

export async function createQuickFill(data: {
  name: string;
  nominal: number;
  categoryId?: string | null;
  managementId: string;
}): Promise<QuickFillPreset> {
  await assertCategoryBelongsToManagement(data.categoryId, data.managementId);

  const maxOrder = await prisma.quickFill.aggregate({
    where: { managementId: data.managementId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const preset = await prisma.quickFill.create({
    data: {
      name: data.name,
      nominal: data.nominal,
      categoryId: data.categoryId ?? null,
      managementId: data.managementId,
      order: nextOrder,
    },
    include: { category: true },
  });
  return {
    id: preset.id,
    name: preset.name,
    nominal: preset.nominal,
    category: preset.category?.name ?? null,
    categoryId: preset.categoryId,
  };
}

export async function updateQuickFill(id: string, data: { name?: string; nominal?: number; categoryId?: string | null }, managementId: string): Promise<QuickFillPreset> {
  await assertCategoryBelongsToManagement(data.categoryId, managementId);

  const updateData = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.nominal !== undefined && { nominal: data.nominal }),
    ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
  };

  const result = await prisma.quickFill.updateMany({
    where: { id, managementId },
    data: updateData,
  });

  if (result.count === 0) throw new Error("Quick-fill preset not found");

  const preset = await prisma.quickFill.findFirst({
    where: { id, managementId },
    include: { category: true },
  });

  if (!preset) throw new Error("Quick-fill preset not found");

  return {
    id: preset.id,
    name: preset.name,
    nominal: preset.nominal,
    category: preset.category?.name ?? null,
    categoryId: preset.categoryId,
  };
}

export async function deleteQuickFill(id: string, managementId: string): Promise<void> {
  const result = await prisma.quickFill.deleteMany({ where: { id, managementId } });
  if (result.count === 0) throw new Error("Quick-fill preset not found");
}
