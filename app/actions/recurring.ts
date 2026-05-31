"use server";

import {
  getRecurringEntries,
  createRecurringEntry,
  updateRecurringEntry,
  deleteRecurringEntry,
  generateRecurringEntries,
  type RecurringEntryData,
  type RecurringFrequency,
  type IOType,
} from "@/lib/db";
import { getCurrentManagementId } from "@/lib/management";

export async function fetchRecurringEntries(): Promise<RecurringEntryData[]> {
  const managementId = await getCurrentManagementId();
  return getRecurringEntries(managementId);
}

export async function addRecurringEntry(data: {
  name: string;
  nominal: number;
  categoryId?: string | null;
  io: IOType;
  frequency: RecurringFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  startDate: string;
  endDate?: string | null;
}): Promise<RecurringEntryData> {
  const managementId = await getCurrentManagementId();
  return createRecurringEntry({ ...data, managementId });
}

export async function editRecurringEntry(
  id: string,
  data: Partial<{
    name: string;
    nominal: number;
    categoryId: string | null;
    io: IOType;
    frequency: RecurringFrequency;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    monthOfYear: number | null;
    startDate: string;
    endDate: string | null;
    active: boolean;
  }>,
): Promise<RecurringEntryData> {
  const managementId = await getCurrentManagementId();
  return updateRecurringEntry(id, data, managementId);
}

export async function removeRecurringEntry(id: string): Promise<void> {
  const managementId = await getCurrentManagementId();
  return deleteRecurringEntry(id, managementId);
}

export async function runRecurringGeneration(): Promise<number> {
  const managementId = await getCurrentManagementId();
  return generateRecurringEntries(managementId);
}
