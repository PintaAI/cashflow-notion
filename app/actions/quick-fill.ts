"use server";

import {
  getQuickFills,
  createQuickFill,
  updateQuickFill,
  deleteQuickFill,
  type QuickFillPreset,
} from "@/lib/db";

export async function fetchQuickFills(): Promise<QuickFillPreset[]> {
  return getQuickFills();
}

export async function addQuickFill(data: {
  name: string;
  nominal: number;
  categoryId?: string | null;
}): Promise<QuickFillPreset> {
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error("Name cannot be empty");
  }
  if (data.nominal <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  return createQuickFill({ ...data, name: trimmedName });
}

export async function editQuickFill(id: string, data: { name?: string; nominal?: number; categoryId?: string | null }): Promise<QuickFillPreset> {
  return updateQuickFill(id, data);
}

export async function removeQuickFill(id: string): Promise<void> {
  await deleteQuickFill(id);
}
