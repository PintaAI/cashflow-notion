import { prisma } from "@/lib/db/client";
import type { QuickFillPreset } from "@/lib/db/types";

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

export async function updateQuickFill(id: string, data: { name?: string; nominal?: number; categoryId?: string | null }): Promise<QuickFillPreset> {
  const preset = await prisma.quickFill.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.nominal !== undefined && { nominal: data.nominal }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
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

export async function deleteQuickFill(id: string): Promise<void> {
  await prisma.quickFill.delete({ where: { id } });
}
