"use server";

import {
  getAllEntries,
  getSummary,
  createEntry,
  updateEntry,
  deleteEntry,
  getEntries,
  countEntries,
  getEntriesFiltered,
  getEntriesByIOPaginated,
  getCalendarEntries,
} from "@/lib/db";
import type { CashflowEntry, CashflowSummary, IOType, CategoryType, CalendarDayData } from "@/lib/db";
import { getCurrentManagementId, getSession } from "@/lib/management";
import { checkBudgetAlerts } from "@/lib/budget-alerts";
import { prisma } from "@/lib/db";

export async function fetchAllEntries(): Promise<CashflowEntry[]> {
  const managementId = await getCurrentManagementId();
  return getAllEntries(managementId);
}

export async function fetchSummary(): Promise<CashflowSummary> {
  const managementId = await getCurrentManagementId();
  return getSummary(managementId);
}

export async function fetchEntriesPage(options?: {
  pageSize?: number;
  skip?: number;
}): Promise<{
  entries: CashflowEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const managementId = await getCurrentManagementId();
  return getEntries({
    pageSize: options?.pageSize ?? 20,
    skip: options?.skip ?? 0,
    managementId,
  });
}

export async function fetchEntriesFiltered(options?: {
  pageSize?: number;
  skip?: number;
  io?: IOType;
  date?: string;
}): Promise<{
  entries: CashflowEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const managementId = await getCurrentManagementId();
  return getEntriesFiltered({
    pageSize: options?.pageSize ?? 20,
    skip: options?.skip ?? 0,
    io: options?.io,
    date: options?.date,
    managementId,
  });
}

export async function fetchIncomeEntries(options?: {
  pageSize?: number;
  skip?: number;
}): Promise<{
  entries: CashflowEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const managementId = await getCurrentManagementId();
  return getEntriesByIOPaginated("Income", {
    pageSize: options?.pageSize ?? 20,
    skip: options?.skip ?? 0,
    managementId,
  });
}

export async function fetchExpensesEntries(options?: {
  pageSize?: number;
  skip?: number;
}): Promise<{
  entries: CashflowEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const managementId = await getCurrentManagementId();
  return getEntriesByIOPaginated("Expenses", {
    pageSize: options?.pageSize ?? 20,
    skip: options?.skip ?? 0,
    managementId,
  });
}

export async function fetchTotalCount(): Promise<number> {
  const managementId = await getCurrentManagementId();
  return countEntries(managementId);
}

export async function addEntry(data: {
  name: string;
  nominal: number;
  category?: CategoryType;
  date?: string;
  io?: IOType;
}): Promise<CashflowEntry> {
  const managementId = await getCurrentManagementId();
  const session = await getSession();
  const entry = await createEntry({ ...data, managementId, userId: session?.user.id });

  if (data.io === "Expenses" && data.category) {
    const cat = await prisma.category.findFirst({ where: { name: data.category, managementId } });
    if (cat) {
      checkBudgetAlerts(managementId, { categoryId: cat.id, io: data.io, date: data.date });
    }
  }

  return entry;
}

export async function editEntry(
  pageId: string,
  data: Partial<{
    name: string;
    nominal: number;
    category: CategoryType;
    date: string;
    io: IOType;
  }>
): Promise<CashflowEntry> {
  const managementId = await getCurrentManagementId();
  const entry = await updateEntry(pageId, { ...data, managementId });

  if (data.io === "Expenses" && data.category) {
    const cat = await prisma.category.findFirst({ where: { name: data.category, managementId } });
    if (cat) {
      checkBudgetAlerts(managementId, { categoryId: cat.id, io: data.io, date: data.date });
    }
  }

  return entry;
}

export async function removeEntry(pageId: string): Promise<void> {
  return deleteEntry(pageId);
}

export async function fetchCalendarEntries(
  year: number,
  month: number,
  io?: IOType,
): Promise<Record<string, CalendarDayData>> {
  const managementId = await getCurrentManagementId();
  return getCalendarEntries(managementId, year, month, io);
}
