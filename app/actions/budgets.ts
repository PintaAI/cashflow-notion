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
import { resolveManagementId } from "@/lib/management";

export async function fetchBudgetStatus(managementId?: string): Promise<BudgetStatusItem[]> {
  managementId = await resolveManagementId(managementId);
  return getBudgetStatus(managementId);
}

export async function fetchOverallBudgets(managementId?: string): Promise<OverallBudgetOption[]> {
  managementId = await resolveManagementId(managementId);
  return getOverallBudgets(managementId);
}

export async function saveOverallBudget(period: BudgetPeriod, amount: number, managementId?: string): Promise<OverallBudgetOption> {
  managementId = await resolveManagementId(managementId);
  return upsertOverallBudget(managementId, period, amount);
}

export async function removeOverallBudget(period: BudgetPeriod, managementId?: string): Promise<void> {
  managementId = await resolveManagementId(managementId);
  return deleteOverallBudget(managementId, period);
}
