import { prisma } from "@/lib/db/client";
import { formatDate } from "@/lib/db/dates";
import type { AuditSnapshotData, IOType } from "@/lib/db/types";

export async function getBalanceAsOf(managementId: string): Promise<number> {
  const [incomeAgg, expensesAgg] = await Promise.all([
    prisma.entry.aggregate({ where: { managementId, io: "Income" }, _sum: { nominal: true } }),
    prisma.entry.aggregate({ where: { managementId, io: "Expenses" }, _sum: { nominal: true } }),
  ]);

  const totalIncome = incomeAgg._sum.nominal ?? 0;
  const totalExpenses = expensesAgg._sum.nominal ?? 0;

  return totalIncome - totalExpenses;
}

async function getAdjustmentCategoryId(managementId: string): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { name: "Penyesuaian", managementId },
  });
  if (existing) return existing.id;

  const created = await prisma.category.create({
    data: { name: "Penyesuaian", color: "gray", icon: "Audit01Icon", managementId },
  });
  return created.id;
}

export async function createAuditSnapshot(params: {
  managementId: string;
  userId: string;
  actualBalance: number;
  note?: string;
  autoAdjust: boolean;
}): Promise<AuditSnapshotData> {
  const today = formatDate(new Date());
  const expectedBalance = await getBalanceAsOf(params.managementId);
  const difference = params.actualBalance - expectedBalance;

  let adjustmentEntryId: string | null = null;

  if (params.autoAdjust && Math.abs(difference) > 0.01) {
    const categoryId = await getAdjustmentCategoryId(params.managementId);
    const io: IOType = difference > 0 ? "Income" : "Expenses";

    const entry = await prisma.entry.create({
      data: {
        name: `Penyesuaian audit ${today}`,
        nominal: Math.abs(difference),
        originalNominal: Math.abs(difference),
        originalCurrency: "IDR",
        exchangeRateToIdr: 1,
        exchangeRateAt: new Date(),
        categoryId,
        date: today,
        io,
        isReconciliation: true,
        managementId: params.managementId,
        createdById: params.userId,
      },
    });
    adjustmentEntryId = entry.id;
  }

  const snapshot = await prisma.auditSnapshot.create({
    data: {
      managementId: params.managementId,
      date: today,
      expectedBalance,
      actualBalance: params.actualBalance,
      difference,
      adjustmentEntryId,
      note: params.note ?? null,
      createdById: params.userId,
    },
  });

  return {
    id: snapshot.id,
    date: snapshot.date,
    expectedBalance: snapshot.expectedBalance,
    actualBalance: snapshot.actualBalance,
    difference: snapshot.difference,
    adjusted: adjustmentEntryId !== null,
    note: snapshot.note,
    createdAt: snapshot.createdAt,
  };
}

export async function getAuditHistory(managementId: string, limit = 5): Promise<AuditSnapshotData[]> {
  const snapshots = await prisma.auditSnapshot.findMany({
    where: { managementId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return snapshots.map((s) => ({
    id: s.id,
    date: s.date,
    expectedBalance: s.expectedBalance,
    actualBalance: s.actualBalance,
    difference: s.difference,
    adjusted: s.adjustmentEntryId !== null,
    note: s.note,
    createdAt: s.createdAt,
  }));
}

export async function getLatestAuditSnapshot(managementId: string): Promise<AuditSnapshotData | null> {
  const snapshot = await prisma.auditSnapshot.findFirst({
    where: { managementId },
    orderBy: { createdAt: "desc" },
  });

  if (!snapshot) return null;

  return {
    id: snapshot.id,
    date: snapshot.date,
    expectedBalance: snapshot.expectedBalance,
    actualBalance: snapshot.actualBalance,
    difference: snapshot.difference,
    adjusted: snapshot.adjustmentEntryId !== null,
    note: snapshot.note,
    createdAt: snapshot.createdAt,
  };
}
