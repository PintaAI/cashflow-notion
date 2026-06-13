import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getBudgetStatus, upsertOverallBudget, updateCategoryOption } from "@/lib/db";
import type { BudgetPeriod } from "@/lib/db";
import { ok, toolError, getManagementId, toIdrAmount } from "@/lib/mcp/tools/utils";

const budgetPeriodSchema = z.enum(["daily", "weekly", "monthly", "yearly"]).describe("Budget period");

export function registerBudgetTools(server: McpServer) {
  server.registerTool(
    "get_budget_status",
    {
      title: "Get Budget Status",
      description: "Get overall and per-category budget status for all periods (daily, weekly, monthly, yearly). Shows budget amount, spent, remaining, and percentage.",
    },
    async () => {
      try {
        const status = await getBudgetStatus(getManagementId());
        return ok(`Found ${status.length} budget tracking item${status.length === 1 ? "" : "s"}.`, { budgets: status });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "create_overall_budget",
    {
      title: "Create Overall Budget",
      description: "Create or update an overall budget for a specific period. Amount is in the user's preferred currency.",
      inputSchema: {
        period: budgetPeriodSchema,
        amount: z.number().positive().describe("Budget amount in the user's preferred currency"),
      },
    },
    async ({ period, amount }) => {
      try {
        const idrAmount = await toIdrAmount(amount);
        const budget = await upsertOverallBudget(getManagementId(), period as BudgetPeriod, idrAmount);
        return ok(`Set ${period} overall budget to ${idrAmount} IDR.`, budget);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "set_category_budget",
    {
      title: "Set Category Budget",
      description: "Set a budget for a specific category and period. Amount is in the user's preferred currency.",
      inputSchema: {
        categoryId: z.string().min(1).describe("Category ID"),
        period: budgetPeriodSchema,
        amount: z.number().positive().describe("Budget amount in the user's preferred currency"),
      },
    },
    async ({ categoryId, period, amount }) => {
      try {
        const idrAmount = await toIdrAmount(amount);
        const budgetField = period === "daily" ? "budgetDaily" as const : period === "weekly" ? "budgetWeekly" as const : period === "monthly" ? "budgetMonthly" as const : "budgetYearly" as const;
        await updateCategoryOption(categoryId, { [budgetField]: idrAmount }, getManagementId());
        return ok(`Set ${period} budget to ${idrAmount} IDR for category.`, { categoryId, period, amount: idrAmount });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
