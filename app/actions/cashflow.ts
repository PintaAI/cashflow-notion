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
} from "@/lib/db";
import type { CashflowEntry, CashflowSummary, IOType, CategoryType } from "@/lib/db";
import { getCurrentManagementId } from "@/lib/management";

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
  if (data.io === "Expenses" && !data.category) {
    throw new Error("Category is required for expenses")
  }
  return createEntry({ ...data, managementId });
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
  return updateEntry(pageId, { ...data, managementId });
}

export async function removeEntry(pageId: string): Promise<void> {
  return deleteEntry(pageId);
}
