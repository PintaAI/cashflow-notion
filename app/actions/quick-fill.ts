"use server";

import {
  getQuickFills,
  createQuickFill,
  updateQuickFill,
  deleteQuickFill,
  type QuickFillPreset,
} from "@/lib/db";
import { resolveManagementId } from "@/lib/management";

export async function fetchQuickFills(managementId?: string): Promise<QuickFillPreset[]> {
  managementId = await resolveManagementId(managementId);
  return getQuickFills(managementId);
}

export async function addQuickFill(data: {
  managementId?: string;
  name: string;
  nominal: number;
  categoryId?: string | null;
}): Promise<QuickFillPreset> {
  const managementId = await resolveManagementId(data.managementId);
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error("Name cannot be empty");
  }
  if (data.nominal <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  return createQuickFill({ ...data, name: trimmedName, managementId });
}

export async function editQuickFill(id: string, data: { name?: string; nominal?: number; categoryId?: string | null; managementId?: string }): Promise<QuickFillPreset> {
  await resolveManagementId(data.managementId);
  const quickFillData = {
    name: data.name,
    nominal: data.nominal,
    categoryId: data.categoryId,
  };
  return updateQuickFill(id, quickFillData);
}

export async function removeQuickFill(id: string, managementId?: string): Promise<void> {
  await resolveManagementId(managementId);
  await deleteQuickFill(id);
}
