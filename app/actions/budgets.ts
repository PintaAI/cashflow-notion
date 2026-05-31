"use server";

import {
  getBudgetStatus,
  getOverallBudgets,
  upsertOverallBudget,
  deleteOverallBudget,
  type BudgetPeriod,
  type BudgetStatusItem,
  type OverallBudgetOption,
} from "@/lib/db";
import { getCurrentManagementId } from "@/lib/management";

export async function fetchBudgetStatus(): Promise<BudgetStatusItem[]> {
  const managementId = await getCurrentManagementId();
  return getBudgetStatus(managementId);
}

export async function fetchOverallBudgets(): Promise<OverallBudgetOption[]> {
  const managementId = await getCurrentManagementId();
  return getOverallBudgets(managementId);
}

export async function saveOverallBudget(period: BudgetPeriod, amount: number): Promise<OverallBudgetOption> {
  const managementId = await getCurrentManagementId();
  return upsertOverallBudget(managementId, period, amount);
}

export async function removeOverallBudget(period: BudgetPeriod): Promise<void> {
  const managementId = await getCurrentManagementId();
  return deleteOverallBudget(managementId, period);
}
