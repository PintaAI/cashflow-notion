import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  addCategoryOption,
  getCategoryOptions,
  getCategoryOptionsWithUsage,
  getCategoryUsageCount,
  removeCategoryOption,
  updateCategoryOption,
} from "@/lib/db";
import { fromIdrAmount, getManagementId, getUserCurrencyContext, ok, toolError, type UserCurrencyContext } from "@/lib/mcp/tools/utils";

function convertCategoryBudgets<T extends {
  budgetDaily: number | null;
  budgetWeekly: number | null;
  budgetMonthly: number | null;
  budgetYearly: number | null;
}>(category: T, ctx: UserCurrencyContext): T & { currency: string } {
  return {
    ...category,
    budgetDaily: category.budgetDaily == null ? null : fromIdrAmount(category.budgetDaily, ctx),
    budgetWeekly: category.budgetWeekly == null ? null : fromIdrAmount(category.budgetWeekly, ctx),
    budgetMonthly: category.budgetMonthly == null ? null : fromIdrAmount(category.budgetMonthly, ctx),
    budgetYearly: category.budgetYearly == null ? null : fromIdrAmount(category.budgetYearly, ctx),
    currency: ctx.currency,
  };
}

export function registerCategoryTools(server: McpServer) {
  server.registerTool(
    "list_categories",
    {
      title: "List Categories",
      description: "List all cashflow categories with colors and icons.",
    },
    async () => {
      try {
        const ctx = await getUserCurrencyContext();
        const categories = await getCategoryOptions(getManagementId());
        return ok(`Found ${categories.length} categor${categories.length === 1 ? "y" : "ies"}.`, {
          categories: categories.map((category) => convertCategoryBudgets(category, ctx)),
          currency: ctx.currency,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "get_category_details",
    {
      title: "Get Category Details",
      description: "List categories with usage counts.",
    },
    async () => {
      try {
        const ctx = await getUserCurrencyContext();
        const categories = await getCategoryOptionsWithUsage(getManagementId());
        return ok(`Found ${categories.length} categor${categories.length === 1 ? "y" : "ies"}.`, {
          categories: categories.map((category) => convertCategoryBudgets(category, ctx)),
          currency: ctx.currency,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "create_category",
    {
      title: "Create Category",
      description: "Create a new cashflow category.",
      inputSchema: {
        name: z.string().trim().min(1),
        color: z.string().trim().min(1).optional(),
        icon: z.string().trim().min(1).optional(),
      },
    },
    async ({ name, color, icon }) => {
      try {
        const ctx = await getUserCurrencyContext();
        const categories = await addCategoryOption(name, color ?? "default", icon, getManagementId());
        return ok("Created category.", {
          categories: categories.map((category) => convertCategoryBudgets(category, ctx)),
          currency: ctx.currency,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "update_category",
    {
      title: "Update Category",
      description: "Update a cashflow category by ID.",
      inputSchema: {
        id: z.string().min(1),
        name: z.string().trim().min(1).optional(),
        color: z.string().trim().min(1).optional(),
        icon: z.string().trim().min(1).nullable().optional(),
      },
    },
    async ({ id, name, color, icon }) => {
      try {
        const ctx = await getUserCurrencyContext();
        const categories = await updateCategoryOption(id, { name, color, icon }, getManagementId());
        return ok("Updated category.", {
          categories: categories.map((category) => convertCategoryBudgets(category, ctx)),
          currency: ctx.currency,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "delete_category",
    {
      title: "Delete Category",
      description: "Permanently delete a category by ID only when it has no entries. This cannot be undone.",
      inputSchema: { id: z.string().min(1).describe("Category ID") },
    },
    async ({ id }) => {
      try {
        const mid = getManagementId();
        const categories = await getCategoryOptions(mid);
        const category = categories.find((item) => item.id === id);
        if (!category) throw new Error(`Category with ID "${id}" not found`);

        const usageCount = await getCategoryUsageCount(category.name, mid);
        if (usageCount > 0) throw new Error(`Category "${category.name}" is used by ${usageCount} entr${usageCount === 1 ? "y" : "ies"}`);

        const ctx = await getUserCurrencyContext();
        const updatedCategories = await removeCategoryOption(id, mid);
        return ok("Deleted category.", {
          id,
          categories: updatedCategories.map((category) => convertCategoryBudgets(category, ctx)),
          currency: ctx.currency,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
