import { prisma } from "@/lib/db/client";
import { getCurrentDateRange } from "@/lib/db/dates";
import type { BudgetPeriod, BudgetStatusItem, OverallBudgetOption } from "@/lib/db/types";

export async function getOverallBudgets(managementId: string): Promise<OverallBudgetOption[]> {
  const budgets = await prisma.overallBudget.findMany({
    where: { managementId },
    orderBy: { period: "asc" },
  });
  return budgets.map((b) => ({
    id: b.id,
    period: b.period as BudgetPeriod,
    amount: b.amount,
  }));
}

export async function upsertOverallBudget(managementId: string, period: BudgetPeriod, amount: number): Promise<OverallBudgetOption> {
  const budget = await prisma.overallBudget.upsert({
    where: { managementId_period: { managementId, period } },
    update: { amount },
    create: { managementId, period, amount },
  });
  return { id: budget.id, period: budget.period as BudgetPeriod, amount: budget.amount };
}

export async function deleteOverallBudget(managementId: string, period: BudgetPeriod): Promise<void> {
  await prisma.overallBudget.deleteMany({ where: { managementId, period } });
}

export async function getBudgetStatus(managementId: string): Promise<BudgetStatusItem[]> {
  const [categories, overallBudgets] = await Promise.all([
    prisma.category.findMany({
      where: { managementId },
      orderBy: { name: "asc" },
    }),
    prisma.overallBudget.findMany({ where: { managementId } }),
  ]);

  const periods: BudgetPeriod[] = ["daily", "weekly", "monthly", "yearly"];

  const periodResults = await Promise.all(
    periods.map(async (period) => {
      const results: BudgetStatusItem[] = [];
      const { start, end } = getCurrentDateRange(period);

      const overallBudget = overallBudgets.find((b) => b.period === period);
      if (overallBudget) {
        const overallSpent = await prisma.entry.aggregate({
          where: {
            managementId,
            io: "Expenses",
            date: { gte: start, lte: end },
          },
          _sum: { nominal: true },
        });
        const spent = overallSpent._sum.nominal ?? 0;
        const percentage = overallBudget.amount > 0 ? Math.round((spent / overallBudget.amount) * 100) : 0;
        results.push({
          type: "overall",
          id: overallBudget.id,
          name: "Total",
          period,
          budgetAmount: overallBudget.amount,
          spent,
          remaining: Math.max(0, overallBudget.amount - spent),
          percentage,
          isWarning: percentage >= 80 && percentage < 100,
          isOverBudget: percentage >= 100,
        });
      }

      const budgetField = period === "daily" ? "budgetDaily" as const : period === "weekly" ? "budgetWeekly" as const : period === "monthly" ? "budgetMonthly" as const : "budgetYearly" as const;
      const categoriesWithBudget = categories.filter((c) => c[budgetField] != null);

      if (categoriesWithBudget.length > 0) {
        const categoryIds = categoriesWithBudget.map((c) => c.id);
        const categorySpending = await prisma.entry.groupBy({
          by: ["categoryId"],
          where: {
            managementId,
            io: "Expenses",
            categoryId: { in: categoryIds },
            date: { gte: start, lte: end },
          },
          _sum: { nominal: true },
        });

        const spendingMap = new Map(
          categorySpending.map((s) => [s.categoryId, s._sum.nominal ?? 0])
        );

        for (const category of categoriesWithBudget) {
          const budgetAmount = category[budgetField]!;
          const spent = spendingMap.get(category.id) ?? 0;
          const percentage = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;
          results.push({
            type: "category",
            id: category.id,
            name: category.name,
            period,
            budgetAmount,
            spent,
            remaining: Math.max(0, budgetAmount - spent),
            percentage,
            isWarning: percentage >= 80 && percentage < 100,
            isOverBudget: percentage >= 100,
          });
        }
      }

      return results;
    })
  );

  return periodResults.flat();
}
