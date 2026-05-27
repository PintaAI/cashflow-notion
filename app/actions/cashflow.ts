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
} from "@/lib/notion";
import type { CashflowEntry, CashflowSummary, IOType, CategoryType } from "@/lib/notion";

// Server actions for data fetching
export async function fetchAllEntries(): Promise<CashflowEntry[]> {
  return getAllEntries();
}

export async function fetchSummary(): Promise<CashflowSummary> {
  return getSummary();
}

// Paginated fetch for infinite loading
export async function fetchEntriesPage(options?: {
  pageSize?: number;
  cursor?: string | null;
}): Promise<{
  entries: CashflowEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  return getEntries({
    pageSize: options?.pageSize ?? 20,
    startCursor: options?.cursor ?? undefined,
  });
}

// Paginated fetch with I/O and date filter for infinite loading
export async function fetchEntriesFiltered(options?: {
  pageSize?: number;
  cursor?: string | null;
  io?: IOType;
  date?: string;
}): Promise<{
  entries: CashflowEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  return getEntriesFiltered({
    pageSize: options?.pageSize ?? 20,
    startCursor: options?.cursor ?? undefined,
    io: options?.io,
    date: options?.date,
  });
}

// Paginated fetch for Income entries only
export async function fetchIncomeEntries(options?: {
  pageSize?: number;
  cursor?: string | null;
}): Promise<{
  entries: CashflowEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  return getEntriesByIOPaginated("Income", {
    pageSize: options?.pageSize ?? 20,
    startCursor: options?.cursor ?? undefined,
  });
}

// Paginated fetch for Expenses entries only
export async function fetchExpensesEntries(options?: {
  pageSize?: number;
  cursor?: string | null;
}): Promise<{
  entries: CashflowEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  return getEntriesByIOPaginated("Expenses", {
    pageSize: options?.pageSize ?? 20,
    startCursor: options?.cursor ?? undefined,
  });
}

// Get total count for display
export async function fetchTotalCount(): Promise<number> {
  return countEntries();
}

// Server actions for mutations
export async function addEntry(data: {
  name: string;
  nominal: number;
  category?: CategoryType;
  date?: string;
  io?: IOType;
}): Promise<CashflowEntry> {
  if (data.io === "Expenses" && !data.category) {
    throw new Error("Category is required for expenses")
  }
  return createEntry(data);
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
  return updateEntry(pageId, data);
}

export async function removeEntry(pageId: string): Promise<void> {
  return deleteEntry(pageId);
}