import { Prisma } from "@prisma/client";

import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { prisma } from "@/lib/db/client";
import { formatDate } from "@/lib/db/dates";
import type { CalendarDayData, CashflowEntry, CategoryType, EntryForMapping, EntryWhereInput, IOType } from "@/lib/db/types";

const VALID_CURRENCIES = new Set(SUPPORTED_CURRENCIES.map((currency) => currency.code));

function assertValidSnapshot(data: {
  originalNominal?: number;
  originalCurrency?: string;
  exchangeRateToIdr?: number;
}) {
  if (data.originalNominal !== undefined && (!Number.isFinite(data.originalNominal) || data.originalNominal <= 0)) {
    throw new Error("Original amount must be greater than 0");
  }
  if (data.originalCurrency !== undefined && !VALID_CURRENCIES.has(data.originalCurrency)) {
    throw new Error("Invalid original currency");
  }
  if (data.exchangeRateToIdr !== undefined && (!Number.isFinite(data.exchangeRateToIdr) || data.exchangeRateToIdr <= 0)) {
    throw new Error("Exchange rate must be greater than 0");
  }
}

export const entryCreatorSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} satisfies Prisma.UserSelect;

export function toEntry(entry: EntryForMapping): CashflowEntry {
  return {
    id: entry.id,
    name: entry.name,
    nominal: entry.nominal,
    originalNominal: entry.originalNominal,
    originalCurrency: entry.originalCurrency,
    exchangeRateToIdr: entry.exchangeRateToIdr,
    exchangeRateAt: entry.exchangeRateAt,
    category: entry.category?.name ?? null,
    date: entry.date,
    io: entry.io,
    createdById: entry.createdById,
    createdBy: entry.createdBy ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export function buildEntryWhere(filter: {
  io?: IOType;
  category?: CategoryType;
  date?: string;
  startDate?: string;
  endDate?: string;
  createdById?: string | null;
} = {}): EntryWhereInput {
  return {
    ...(filter.io ? { io: filter.io } : {}),
    ...(filter.category ? { category: { is: { name: filter.category } } } : {}),
    ...(filter.createdById !== undefined ? { createdById: filter.createdById } : {}),
    ...(filter.date
      ? { date: filter.date }
      : filter.startDate || filter.endDate
        ? {
            date: {
              ...(filter.startDate ? { gte: filter.startDate } : {}),
              ...(filter.endDate ? { lt: filter.endDate } : {}),
            },
          }
        : {}),
  };
}

export async function getAllEntries(managementId: string): Promise<CashflowEntry[]> {
  const entries = await prisma.entry.findMany({
    where: { managementId },
    include: { category: true, createdBy: { select: entryCreatorSelect } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return entries.map(toEntry);
}

export async function getEntries(options?: {
  pageSize?: number;
  skip?: number;
  managementId: string;
}): Promise<{ entries: CashflowEntry[]; nextCursor: string | null; hasMore: boolean }> {
  return getEntriesFiltered({ pageSize: options?.pageSize, skip: options?.skip, managementId: options!.managementId });
}

export async function countEntries(managementId: string): Promise<number> {
  return prisma.entry.count({ where: { managementId } });
}

export async function countEntriesForDate(date: string, managementId: string): Promise<number> {
  return prisma.entry.count({ where: { date, managementId } });
}

export async function getEntriesFiltered(options?: {
  pageSize?: number;
  skip?: number;
  io?: IOType;
  category?: CategoryType;
  date?: string;
  startDate?: string;
  endDate?: string;
  createdById?: string | null;
  managementId: string;
}): Promise<{ entries: CashflowEntry[]; nextCursor: string | null; hasMore: boolean }> {
  const pageSize = options?.pageSize || 20;
  const skip = options?.skip || 0;
  const where = {
    managementId: options!.managementId,
    ...buildEntryWhere({ io: options?.io, category: options?.category, date: options?.date, startDate: options?.startDate, endDate: options?.endDate, createdById: options?.createdById }),
  };

  const entries = await prisma.entry.findMany({
    where,
    include: { category: true, createdBy: { select: entryCreatorSelect } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    skip,
    take: pageSize + 1,
  });

  return {
    entries: entries.slice(0, pageSize).map(toEntry),
    nextCursor: null,
    hasMore: entries.length > pageSize,
  };
}

export async function getEntriesByIOPaginated(ioType: IOType, options?: {
  pageSize?: number;
  skip?: number;
  managementId: string;
}): Promise<{ entries: CashflowEntry[]; nextCursor: string | null; hasMore: boolean }> {
  return getEntriesFiltered({
    pageSize: options?.pageSize,
    skip: options?.skip,
    io: ioType,
    managementId: options!.managementId,
  });
}

async function findCategory(name: CategoryType | undefined, managementId: string) {
  if (!name) return null;
  return prisma.category.findFirst({ where: { name, managementId } });
}

export async function createEntry(data: {
  name: string;
  nominal: number;
  originalNominal?: number;
  originalCurrency?: string;
  exchangeRateToIdr?: number;
  exchangeRateAt?: Date;
  category?: CategoryType;
  date?: string;
  io?: IOType;
  managementId: string;
  userId?: string;
}): Promise<CashflowEntry> {
  assertValidSnapshot(data);
  const category = await findCategory(data.category, data.managementId);
  if (data.category && !category) {
    throw new Error(`Category "${data.category}" not found`);
  }

  const entry = await prisma.entry.create({
    data: {
      name: data.name,
      nominal: data.nominal,
      originalNominal: data.originalNominal ?? data.nominal,
      originalCurrency: data.originalCurrency ?? "IDR",
      exchangeRateToIdr: data.exchangeRateToIdr ?? 1,
      exchangeRateAt: data.exchangeRateAt ?? new Date(),
      categoryId: category?.id ?? null,
      date: data.date ?? formatDate(new Date()),
      io: data.io ?? null,
      managementId: data.managementId,
      createdById: data.userId ?? null,
    },
    include: { category: true, createdBy: { select: entryCreatorSelect } },
  });

  console.log(`DB: Created entry id=${entry.id} name="${entry.name}" nominal=${entry.nominal} managementId=${data.managementId}`);
  return toEntry(entry);
}

export async function updateEntry(
  entryId: string,
  data: Partial<{
    name: string;
    nominal: number;
    originalNominal: number;
    originalCurrency: string;
    exchangeRateToIdr: number;
    exchangeRateAt: Date;
    category: CategoryType;
    date: string;
    io: IOType;
    managementId: string;
    createdById: string | null;
  }>
): Promise<CashflowEntry> {
  if (!data.managementId) throw new Error("managementId required");
  assertValidSnapshot(data);

  const category = data.category === undefined ? undefined : await findCategory(data.category, data.managementId || "");
  if (data.category && !category) {
    throw new Error(`Category "${data.category}" not found`);
  }

  if (data.createdById) {
    const member = await prisma.managementMember.findFirst({
      where: { managementId: data.managementId, userId: data.createdById },
      select: { id: true },
    });
    if (!member) {
      throw new Error("Selected creator is not a member of this management");
    }
  }

  const updateData = {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.nominal !== undefined ? { nominal: data.nominal } : {}),
    ...(data.originalNominal !== undefined ? { originalNominal: data.originalNominal } : {}),
    ...(data.originalCurrency !== undefined ? { originalCurrency: data.originalCurrency } : {}),
    ...(data.exchangeRateToIdr !== undefined ? { exchangeRateToIdr: data.exchangeRateToIdr } : {}),
    ...(data.exchangeRateAt !== undefined ? { exchangeRateAt: data.exchangeRateAt } : {}),
    ...(data.category !== undefined ? { categoryId: category?.id ?? null } : {}),
    ...(data.date !== undefined ? { date: data.date } : {}),
    ...(data.io !== undefined ? { io: data.io } : {}),
    ...(data.createdById !== undefined ? { createdById: data.createdById } : {}),
  };

  const result = await prisma.entry.updateMany({
    where: { id: entryId, managementId: data.managementId },
    data: updateData,
  });

  if (result.count === 0) {
    throw new Error("Entry not found");
  }

  const entry = await prisma.entry.findFirst({
    where: { id: entryId, managementId: data.managementId },
    include: { category: true, createdBy: { select: entryCreatorSelect } },
  });

  if (!entry) throw new Error("Entry not found");

  return toEntry(entry);
}

export async function deleteEntry(entryId: string, managementId: string): Promise<void> {
  const result = await prisma.entry.deleteMany({ where: { id: entryId, managementId } });
  if (result.count === 0) throw new Error("Entry not found");
}

export async function getCalendarEntries(
  managementId: string,
  year: number,
  month: number,
  io?: IOType,
): Promise<Record<string, CalendarDayData>> {
  const firstDay = new Date(year, month, 1);
  const startOfWeek = new Date(firstDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const lastDay = new Date(year, month + 1, 0);
  const endOfWeek = new Date(lastDay);
  endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
  endOfWeek.setDate(endOfWeek.getDate() + 1);

  const startDate = formatDate(startOfWeek);
  const endDate = formatDate(endOfWeek);

  const where: EntryWhereInput = {
    managementId,
    ...buildEntryWhere({ io, startDate, endDate }),
  };

  const entries = await prisma.entry.findMany({
    where,
    include: { category: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const result: Record<string, CalendarDayData> = {};

  for (const entry of entries) {
    const dateKey = entry.date;
    if (!dateKey) continue;

    if (!result[dateKey]) {
      result[dateKey] = { entries: [], income: 0, expenses: 0 };
    }

    const mapped = toEntry(entry);
    result[dateKey].entries.push(mapped);

    if (entry.io === "Income") {
      result[dateKey].income += entry.nominal;
    } else if (entry.io === "Expenses") {
      result[dateKey].expenses += entry.nominal;
    }
  }

  return result;
}
