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
import { resolveManagementId } from "@/lib/management";

export async function fetchRecurringEntries(managementId?: string): Promise<RecurringEntryData[]> {
  managementId = await resolveManagementId(managementId);
  return getRecurringEntries(managementId);
}

export async function addRecurringEntry(data: {
  managementId?: string;
  name: string;
  nominal: number;
  categoryId?: string | null;
  io: IOType;
  frequency: RecurringFrequency;
  reminderTime?: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  startDate: string;
  endDate?: string | null;
}): Promise<RecurringEntryData> {
  const managementId = await resolveManagementId(data.managementId);
  return createRecurringEntry({ ...data, reminderTime: data.reminderTime ?? "09:00", managementId });
}

export async function editRecurringEntry(
  id: string,
  data: Partial<{
    name: string;
    nominal: number;
    categoryId: string | null;
    io: IOType;
    frequency: RecurringFrequency;
    reminderTime: string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    monthOfYear: number | null;
    startDate: string;
    endDate: string | null;
    active: boolean;
    managementId: string;
  }>,
): Promise<RecurringEntryData> {
  const managementId = await resolveManagementId(data.managementId);
  const recurringData = {
    name: data.name,
    nominal: data.nominal,
    categoryId: data.categoryId,
    io: data.io,
    frequency: data.frequency,
    reminderTime: data.reminderTime,
    dayOfWeek: data.dayOfWeek,
    dayOfMonth: data.dayOfMonth,
    monthOfYear: data.monthOfYear,
    startDate: data.startDate,
    endDate: data.endDate,
    active: data.active,
  };
  return updateRecurringEntry(id, recurringData, managementId);
}

export async function removeRecurringEntry(id: string, managementId?: string): Promise<void> {
  managementId = await resolveManagementId(managementId);
  return deleteRecurringEntry(id, managementId);
}

export async function runRecurringGeneration(managementId?: string): Promise<number> {
  managementId = await resolveManagementId(managementId);
  return generateRecurringEntries(managementId);
}
