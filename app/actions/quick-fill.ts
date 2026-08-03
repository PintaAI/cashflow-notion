"use server";

import {
  getQuickFills,
  createQuickFill,
  updateQuickFill,
  deleteQuickFill,
  type QuickFillPreset,
} from "@/lib/db";
import { resolveManagementId } from "@/lib/management";
import { isUniqueConstraintError } from "@/lib/api/client-id";

export async function fetchQuickFills(managementId?: string): Promise<QuickFillPreset[]> {
  managementId = await resolveManagementId(managementId);
  return getQuickFills(managementId);
}

export async function addQuickFill(data: {
  clientId?: string;
  managementId?: string;
  name: string;
  nominal: number;
  categoryId?: string | null;
}): Promise<QuickFillPreset> {
  const managementId = await resolveManagementId(data.managementId);
  if (data.clientId) {
    const existing = (await getQuickFills(managementId)).find((item) => item.id === data.clientId);
    if (existing) return existing;
  }
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error("Name cannot be empty");
  }
  if (data.nominal <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  try {
    return await createQuickFill({ ...data, id: data.clientId, name: trimmedName, managementId });
  } catch (error) {
    if (!data.clientId || !isUniqueConstraintError(error)) throw error;
    const existing = (await getQuickFills(managementId)).find((item) => item.id === data.clientId);
    if (!existing) throw error;
    return existing;
  }
}

export async function editQuickFill(id: string, data: { name?: string; nominal?: number; categoryId?: string | null; managementId?: string }): Promise<QuickFillPreset> {
  const managementId = await resolveManagementId(data.managementId);
  const quickFillData = {
    name: data.name,
    nominal: data.nominal,
    categoryId: data.categoryId,
  };
  return updateQuickFill(id, quickFillData, managementId);
}

export async function removeQuickFill(id: string, managementId?: string): Promise<void> {
  managementId = await resolveManagementId(managementId);
  await deleteQuickFill(id, managementId);
}
