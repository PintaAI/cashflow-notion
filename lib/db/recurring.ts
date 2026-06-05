import { prisma } from "@/lib/db/client";
import { formatDate } from "@/lib/db/dates";
import type { IOType, RecurringEntryData, RecurringFrequency } from "@/lib/db/types";

export async function getRecurringEntries(managementId: string): Promise<RecurringEntryData[]> {
  const entries = await prisma.recurringEntry.findMany({
    where: { managementId },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
  return entries.map((e) => ({
    id: e.id,
    name: e.name,
    nominal: e.nominal,
    categoryId: e.categoryId,
    categoryName: e.category?.name ?? null,
    io: e.io as IOType,
    frequency: e.frequency,
    dayOfWeek: e.dayOfWeek,
    dayOfMonth: e.dayOfMonth,
    monthOfYear: e.monthOfYear,
    startDate: e.startDate,
    endDate: e.endDate,
    lastGenerated: e.lastGenerated,
    active: e.active,
  }));
}

export async function createRecurringEntry(data: {
  managementId: string;
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
  const entry = await prisma.recurringEntry.create({
    data: {
      managementId: data.managementId,
      name: data.name,
      nominal: data.nominal,
      categoryId: data.categoryId ?? null,
      io: data.io,
      frequency: data.frequency,
      dayOfWeek: data.dayOfWeek ?? null,
      dayOfMonth: data.dayOfMonth ?? null,
      monthOfYear: data.monthOfYear ?? null,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
    },
    include: { category: true },
  });
  return {
    id: entry.id,
    name: entry.name,
    nominal: entry.nominal,
    categoryId: entry.categoryId,
    categoryName: entry.category?.name ?? null,
    io: entry.io as IOType,
    frequency: entry.frequency,
    dayOfWeek: entry.dayOfWeek,
    dayOfMonth: entry.dayOfMonth,
    monthOfYear: entry.monthOfYear,
    startDate: entry.startDate,
    endDate: entry.endDate,
    lastGenerated: entry.lastGenerated,
    active: entry.active,
  };
}

export async function updateRecurringEntry(
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
  _managementId: string,
): Promise<RecurringEntryData> {
  const entry = await prisma.recurringEntry.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.nominal !== undefined && { nominal: data.nominal }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.io !== undefined && { io: data.io }),
      ...(data.frequency !== undefined && { frequency: data.frequency }),
      ...(data.dayOfWeek !== undefined && { dayOfWeek: data.dayOfWeek }),
      ...(data.dayOfMonth !== undefined && { dayOfMonth: data.dayOfMonth }),
      ...(data.monthOfYear !== undefined && { monthOfYear: data.monthOfYear }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
      ...(data.active !== undefined && { active: data.active }),
    },
    include: { category: true },
  });
  return {
    id: entry.id,
    name: entry.name,
    nominal: entry.nominal,
    categoryId: entry.categoryId,
    categoryName: entry.category?.name ?? null,
    io: entry.io as IOType,
    frequency: entry.frequency,
    dayOfWeek: entry.dayOfWeek,
    dayOfMonth: entry.dayOfMonth,
    monthOfYear: entry.monthOfYear,
    startDate: entry.startDate,
    endDate: entry.endDate,
    lastGenerated: entry.lastGenerated,
    active: entry.active,
  };
}

export async function deleteRecurringEntry(id: string, managementId: string): Promise<void> {
  await prisma.recurringEntry.deleteMany({ where: { id, managementId } });
}

function shouldGenerateToday(
  entry: { frequency: string; dayOfWeek: number | null; dayOfMonth: number | null; monthOfYear: number | null; startDate: string; endDate: string | null; lastGenerated: string | null },
  today: string,
): boolean {
  if (today < entry.startDate) return false;
  if (entry.endDate && today > entry.endDate) return false;
  if (entry.lastGenerated && entry.lastGenerated >= today) return false;

  const todayDate = new Date(today);
  const dayOfWeek = todayDate.getDay();
  const dayOfMonth = todayDate.getDate();
  const month = todayDate.getMonth() + 1;

  if (entry.frequency === "daily") return true;
  if (entry.frequency === "weekly") return entry.dayOfWeek === dayOfWeek;
  if (entry.frequency === "monthly") return entry.dayOfMonth === dayOfMonth;
  if (entry.frequency === "yearly") return entry.monthOfYear === month && entry.dayOfMonth === dayOfMonth;

  return false;
}

export async function generateRecurringEntries(managementId: string): Promise<number> {
  const today = formatDate(new Date());
  const entries = await prisma.recurringEntry.findMany({
    where: { managementId, active: true },
    include: { category: true },
  });

  let generated = 0;

  for (const recurring of entries) {
    if (!shouldGenerateToday(recurring, today)) continue;

    await prisma.entry.create({
      data: {
        name: recurring.name,
        nominal: recurring.nominal,
        categoryId: recurring.categoryId,
        date: today,
        io: recurring.io,
        managementId,
      },
    });

    await prisma.recurringEntry.update({
      where: { id: recurring.id },
      data: { lastGenerated: today },
    });

    generated++;
  }

  return generated;
}
