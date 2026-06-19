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
import { assertManagementAccess, resolveManagementId, getSession } from "@/lib/management";
import { checkBudgetAlerts } from "@/lib/budget-alerts";
import { prisma } from "@/lib/db";
import { entryCreatorSelect, toEntry as mapDbEntry } from "@/lib/db/entries";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

const VALID_CURRENCIES = new Set(SUPPORTED_CURRENCIES.map((currency) => currency.code));

export async function fetchAllEntries(managementId?: string): Promise<CashflowEntry[]> {
  managementId = await resolveManagementId(managementId);
  return getAllEntries(managementId);
}

export async function fetchSummary(managementId?: string): Promise<CashflowSummary> {
  managementId = await resolveManagementId(managementId);
  return getSummary(managementId);
}

export async function fetchEntriesPage(options?: {
  managementId?: string;
  pageSize?: number;
  skip?: number;
}): Promise<{
  entries: CashflowEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const managementId = await resolveManagementId(options?.managementId);
  return getEntries({
    pageSize: options?.pageSize ?? 20,
    skip: options?.skip ?? 0,
    managementId,
  });
}

export async function fetchEntriesFiltered(options?: {
  managementId?: string;
  pageSize?: number;
  skip?: number;
  io?: IOType;
  date?: string;
  createdById?: string | null;
}): Promise<{
  entries: CashflowEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const managementId = await resolveManagementId(options?.managementId);
  return getEntriesFiltered({
    pageSize: options?.pageSize ?? 20,
    skip: options?.skip ?? 0,
    io: options?.io,
    date: options?.date,
    createdById: options?.createdById,
    managementId,
  });
}

export async function fetchIncomeEntries(options?: {
  managementId?: string;
  pageSize?: number;
  skip?: number;
}): Promise<{
  entries: CashflowEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const managementId = await resolveManagementId(options?.managementId);
  return getEntriesByIOPaginated("Income", {
    pageSize: options?.pageSize ?? 20,
    skip: options?.skip ?? 0,
    managementId,
  });
}

export async function fetchExpensesEntries(options?: {
  managementId?: string;
  pageSize?: number;
  skip?: number;
}): Promise<{
  entries: CashflowEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const managementId = await resolveManagementId(options?.managementId);
  return getEntriesByIOPaginated("Expenses", {
    pageSize: options?.pageSize ?? 20,
    skip: options?.skip ?? 0,
    managementId,
  });
}

export async function fetchCategoryEntries(category: string, filters?: {
  managementId?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<CashflowEntry[]> {
  const managementId = await resolveManagementId(filters?.managementId);
  const endDate = filters?.to
    ? (() => {
        const [y, m, d] = filters.to.split("-").map(Number);
        const next = new Date(y, m - 1, d);
        next.setDate(next.getDate() + 1);
        return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      })()
    : undefined;
  const result = await getEntriesFiltered({
    pageSize: filters?.limit ?? 50,
    skip: 0,
    category,
    startDate: filters?.from,
    endDate,
    managementId,
  });
  return result.entries;
}

export async function fetchTotalCount(managementId?: string): Promise<number> {
  managementId = await resolveManagementId(managementId);
  return countEntries(managementId);
}

export async function addEntry(data: {
  managementId?: string;
  name: string;
  nominal: number;
  originalNominal?: number;
  originalCurrency?: string;
  exchangeRateToIdr?: number;
  exchangeRateAt?: Date;
  category?: CategoryType;
  date?: string;
  io?: IOType;
}): Promise<CashflowEntry> {
  const managementId = await resolveManagementId(data.managementId);
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
    managementId: string;
    name: string;
    nominal: number;
    originalNominal: number;
    originalCurrency: string;
    exchangeRateToIdr: number;
    exchangeRateAt: Date;
    category: CategoryType;
    date: string;
    io: IOType;
    createdById: string | null;
  }>
): Promise<CashflowEntry> {
  const managementId = await resolveManagementId(data.managementId);
  const entry = await updateEntry(pageId, { ...data, managementId });

  if (data.io === "Expenses" && data.category) {
    const cat = await prisma.category.findFirst({ where: { name: data.category, managementId } });
    if (cat) {
      checkBudgetAlerts(managementId, { categoryId: cat.id, io: data.io, date: data.date });
    }
  }

  return entry;
}

export async function removeEntry(pageId: string, managementId?: string): Promise<void> {
  managementId = await resolveManagementId(managementId);
  const entry = await prisma.entry.findFirst({
    where: { id: pageId, managementId },
    select: { id: true },
  });
  if (!entry) throw new Error("Entry not found");
  return deleteEntry(pageId, managementId);
}

async function ensureTransferCategory(managementId: string, name: "Transfer In" | "Transfer Out", io: IOType) {
  const existing = await prisma.category.findFirst({
    where: { managementId, name },
    select: { id: true },
  });
  if (existing) return existing.id;

  const category = await prisma.category.create({
    data: {
      managementId,
      name,
      color: io === "Income" ? "green" : "gray",
      icon: io === "Income" ? "MoneyReceiveIcon" : "MoneySendIcon",
    },
    select: { id: true },
  });
  return category.id;
}

function todayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export async function transferBetweenManagements(data: {
  fromManagementId?: string;
  toManagementId: string;
  nominal: number;
  originalNominal?: number;
  originalCurrency?: string;
  exchangeRateToIdr?: number;
  exchangeRateAt?: Date;
  date?: string;
  note?: string;
}): Promise<{ fromEntry: CashflowEntry; toEntry: CashflowEntry }> {
  const fromManagementId = await resolveManagementId(data.fromManagementId);
  const { session } = await assertManagementAccess(data.toManagementId);

  if (fromManagementId === data.toManagementId) {
    throw new Error("Destination wallet must be different");
  }
  if (data.nominal <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const [fromManagement, toManagement] = await Promise.all([
    prisma.management.findUnique({ where: { id: fromManagementId }, select: { name: true } }),
    prisma.management.findUnique({ where: { id: data.toManagementId }, select: { name: true } }),
  ]);
  if (!fromManagement || !toManagement) throw new Error("Wallet not found");

  const date = data.date ?? todayDateKey();
  const note = data.note?.trim();
  const fromName = note || `Transfer to ${toManagement.name}`;
  const toName = note || `Transfer from ${fromManagement.name}`;
  const originalNominal = data.originalNominal ?? data.nominal;
  const originalCurrency = data.originalCurrency ?? "IDR";
  const exchangeRateToIdr = data.exchangeRateToIdr ?? 1;
  const exchangeRateAt = data.exchangeRateAt ?? new Date();

  if (!Number.isFinite(originalNominal) || originalNominal <= 0) {
    throw new Error("Original amount must be greater than 0");
  }
  if (!VALID_CURRENCIES.has(originalCurrency)) {
    throw new Error("Invalid original currency");
  }
  if (!Number.isFinite(exchangeRateToIdr) || exchangeRateToIdr <= 0) {
    throw new Error("Exchange rate must be greater than 0");
  }

  const [fromCategoryId, toCategoryId] = await Promise.all([
    ensureTransferCategory(fromManagementId, "Transfer Out", "Expenses"),
    ensureTransferCategory(data.toManagementId, "Transfer In", "Income"),
  ]);

  const [fromEntry, destinationEntry] = await prisma.$transaction([
    prisma.entry.create({
      data: {
        managementId: fromManagementId,
        name: fromName,
        nominal: data.nominal,
        originalNominal,
        originalCurrency,
        exchangeRateToIdr,
        exchangeRateAt,
        categoryId: fromCategoryId,
        date,
        io: "Expenses",
        createdById: session.user.id,
      },
      include: { category: true, createdBy: { select: entryCreatorSelect } },
    }),
    prisma.entry.create({
      data: {
        managementId: data.toManagementId,
        name: toName,
        nominal: data.nominal,
        originalNominal,
        originalCurrency,
        exchangeRateToIdr,
        exchangeRateAt,
        categoryId: toCategoryId,
        date,
        io: "Income",
        createdById: session.user.id,
      },
      include: { category: true, createdBy: { select: entryCreatorSelect } },
    }),
  ]);

  return { fromEntry: mapDbEntry(fromEntry), toEntry: mapDbEntry(destinationEntry) };
}

export async function fetchCalendarEntries(
  year: number,
  month: number,
  io?: IOType,
  managementId?: string,
): Promise<Record<string, CalendarDayData>> {
  managementId = await resolveManagementId(managementId);
  return getCalendarEntries(managementId, year, month, io);
}
