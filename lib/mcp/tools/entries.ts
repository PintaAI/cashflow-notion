import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  buildEntryWhere,
  createEntry,
  deleteEntry,
  getBudgetStatus,
  prisma,
  updateEntry,
  type IOType,
} from "@/lib/db";
import {
  fromIdrAmount,
  getManagementId,
  getUserCurrencyContext,
  getUserId,
  isValidDate,
  ok,
  toIdrAmount,
  toolError,
  type UserCurrencyContext,
} from "@/lib/mcp/tools/utils";

const entryFields = {
  name: z.string().trim().min(1).describe("Entry name"),
  nominal: z.number().positive().describe("Amount of money in the user's preferred currency"),
  category: z.string().trim().min(1).describe("Required category name. Must exactly match an existing category from list_categories. If missing or unclear, ask the user to choose a category before calling this tool."),
  date: z.string().describe("Required entry date in YYYY-MM-DD format. If missing, relative, or ambiguous, ask the user to clarify the exact date before calling this tool."),
  io: z.enum(["Income", "Expenses"]).describe("Whether this entry is Income or Expenses"),
};

function toEntry(entry: Awaited<ReturnType<typeof prisma.entry.findFirst>> & { category?: { name: string } | null }, ctx: UserCurrencyContext) {
  if (!entry) return null;
  const currency = entry.originalCurrency ?? ctx.currency;
  return {
    id: entry.id,
    name: entry.name,
    nominal: entry.originalNominal ?? fromIdrAmount(entry.nominal, ctx),
    currency,
    nominalIdr: entry.nominal,
    exchangeRateToIdr: entry.exchangeRateToIdr,
    category: entry.category?.name ?? null,
    date: entry.date,
    io: entry.io,
  };
}

export function registerEntryTools(server: McpServer) {
  server.registerTool(
    "list_entries",
    {
      title: "List Cashflow Entries",
      description: "List income and expense entries with optional filters and pagination.",
      inputSchema: {
        io: z.enum(["Income", "Expenses"]).optional(),
        category: z.string().trim().min(1).optional().describe("Filter by category name — use list_categories to see available categories"),
        date: z.string().optional().describe("Date in YYYY-MM-DD format"),
        pageSize: z.number().int().min(1).max(100).optional(),
        skip: z.number().int().min(0).optional(),
      },
    },
    async ({ io, category, date, pageSize = 20, skip = 0 }) => {
      try {
        if (date && !isValidDate(date)) throw new Error("Date must be a valid YYYY-MM-DD value");

        const mid = getManagementId();
        const ctx = await getUserCurrencyContext();
        const entries = await prisma.entry.findMany({
          where: { managementId: mid, ...buildEntryWhere({ io: io as IOType | undefined, category, date }) },
          include: { category: true },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          skip,
          take: pageSize + 1,
        });
        const items = entries.slice(0, pageSize).map((entry) => toEntry(entry, ctx));

        return ok(`Found ${items.length} cashflow entr${items.length === 1 ? "y" : "ies"}.`, {
          entries: items,
          currency: ctx.currency,
          hasMore: entries.length > pageSize,
          nextSkip: entries.length > pageSize ? skip + pageSize : null,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "get_entry",
    {
      title: "Get Cashflow Entry",
      description: "Get one cashflow entry by ID.",
      inputSchema: { id: z.string().min(1).describe("Entry ID") },
    },
    async ({ id }) => {
      try {
        const entry = await prisma.entry.findFirst({
          where: { id, managementId: getManagementId() },
          include: { category: true },
        });
        if (!entry) throw new Error(`Entry with ID "${id}" not found`);
        const ctx = await getUserCurrencyContext();
        return ok("Found cashflow entry.", toEntry(entry, ctx));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "create_entry",
    {
      title: "Create Cashflow Entry",
      description: "Create a new income or expense entry. Do not guess date or category: date is required as YYYY-MM-DD, and category must exactly match list_categories. If either is missing or ambiguous, ask the user for clarification before calling this tool.",
      inputSchema: entryFields,
    },
    async ({ name, nominal, category, date, io }) => {
      try {
        if (!isValidDate(date)) throw new Error("Date must be a valid YYYY-MM-DD value");

        const managementId = getManagementId();
        const ctx = await getUserCurrencyContext();
        const exchangeRateToIdr = ctx.currency === "IDR" ? 1 : 1 / ctx.rate;
        const idrNominal = await toIdrAmount(nominal, ctx);
        const entry = await createEntry({
          name,
          nominal: idrNominal,
          originalNominal: nominal,
          originalCurrency: ctx.currency,
          exchangeRateToIdr,
          exchangeRateAt: new Date(),
          category,
          date,
          io,
          managementId,
          userId: getUserId(),
        });
        const management = await prisma.management.findUnique({ where: { id: managementId }, select: { name: true } });
        console.log(`MCP: create_entry succeeded id=${entry.id} name="${entry.name}" nominal=${idrNominal} (IDR) management="${management?.name}"`);

        let warnings: string | undefined;
        if (io === "Expenses") {
          const status = await getBudgetStatus(managementId);
          const relevant = status.filter(
            (s) => (s.isWarning || s.isOverBudget) && (s.type === "overall" || s.name === entry.category),
          );
          if (relevant.length > 0) {
            warnings = relevant
              .map((s) => `⚠ ${s.isOverBudget ? "OVER" : "Near"} ${s.type === "overall" ? "total" : s.name} ${s.period} budget: ${s.percentage}% (${fromIdrAmount(s.spent, ctx)} / ${fromIdrAmount(s.budgetAmount, ctx)} ${ctx.currency})`)
              .join("\n");
          }
        }

        const message = warnings
          ? `Created cashflow entry in ${management?.name ?? managementId}.\n\nBudget Warnings:\n${warnings}`
          : `Created cashflow entry in ${management?.name ?? managementId}.`;

        return ok(message, {
          ...entry,
          nominal: entry.originalNominal ?? fromIdrAmount(entry.nominal, ctx),
          currency: entry.originalCurrency ?? ctx.currency,
          nominalIdr: entry.nominal,
          managementName: management?.name ?? null,
          budgetWarnings: warnings ?? null,
        });
      } catch (error) {
        console.error("MCP: create_entry failed", error instanceof Error ? error.message : error);
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "create_entries",
    {
      title: "Create Multiple Cashflow Entries",
      description: "Create multiple income or expense entries in one call. Amounts are in the user's preferred currency. Do not guess dates or categories: every entry must include date as YYYY-MM-DD and a category that exactly matches list_categories. If any entry is missing or ambiguous, ask the user for clarification before calling this tool.",
      inputSchema: {
        entries: z.array(z.object(entryFields)).min(1).max(50).describe("Entries to create"),
      },
    },
    async ({ entries }) => {
      try {
        for (const [index, entry] of entries.entries()) {
          if (!isValidDate(entry.date)) {
            throw new Error(`Entry ${index + 1}: date must be a valid YYYY-MM-DD value`);
          }
        }

        const managementId = getManagementId();
        const userId = getUserId();
        const ctx = await getUserCurrencyContext();
        const exchangeRateToIdr = ctx.currency === "IDR" ? 1 : 1 / ctx.rate;
        const categories = [...new Set(entries.map((entry) => entry.category).filter((category): category is string => Boolean(category)))];

        if (categories.length > 0) {
          const existingCategories = await prisma.category.findMany({
            where: { managementId, name: { in: categories } },
            select: { name: true },
          });
          const existingNames = new Set(existingCategories.map((category) => category.name));
          const missingCategories = categories.filter((category) => !existingNames.has(category));
          if (missingCategories.length > 0) {
            throw new Error(`Categories not found: ${missingCategories.join(", ")}`);
          }
        }

        const idrNominals = await Promise.all(entries.map((entry) => toIdrAmount(entry.nominal, ctx)));
        const created = [];
        for (const [index, entry] of entries.entries()) {
          created.push(await createEntry({
            name: entry.name,
            nominal: idrNominals[index],
            originalNominal: entry.nominal,
            originalCurrency: ctx.currency,
            exchangeRateToIdr,
            exchangeRateAt: new Date(),
            category: entry.category,
            date: entry.date,
            io: entry.io,
            managementId,
            userId,
          }));
        }

        const management = await prisma.management.findUnique({ where: { id: managementId }, select: { name: true } });
        let warnings: string | undefined;
        const expenseCategories = new Set(created.filter((entry) => entry.io === "Expenses").map((entry) => entry.category));
        if (expenseCategories.size > 0) {
          const status = await getBudgetStatus(managementId);
          const relevant = status.filter(
            (s) => (s.isWarning || s.isOverBudget) && (s.type === "overall" || expenseCategories.has(s.name)),
          );
          if (relevant.length > 0) {
            warnings = relevant
              .map((s) => `⚠ ${s.isOverBudget ? "OVER" : "Near"} ${s.type === "overall" ? "total" : s.name} ${s.period} budget: ${s.percentage}% (${fromIdrAmount(s.spent, ctx)} / ${fromIdrAmount(s.budgetAmount, ctx)} ${ctx.currency})`)
              .join("\n");
          }
        }

        const message = warnings
          ? `Created ${created.length} cashflow entries in ${management?.name ?? managementId}.\n\nBudget Warnings:\n${warnings}`
          : `Created ${created.length} cashflow entries in ${management?.name ?? managementId}.`;

        return ok(message, {
          entries: created.map((entry) => ({
            ...entry,
            nominal: entry.originalNominal ?? fromIdrAmount(entry.nominal, ctx),
            currency: entry.originalCurrency ?? ctx.currency,
            nominalIdr: entry.nominal,
          })),
          currency: ctx.currency,
          managementName: management?.name ?? null,
          budgetWarnings: warnings ?? null,
        });
      } catch (error) {
        console.error("MCP: create_entries failed", error instanceof Error ? error.message : error);
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "update_entry",
    {
      title: "Update Cashflow Entry",
      description: "Update an existing income or expense entry by ID.",
      inputSchema: {
        id: z.string().min(1).describe("Entry ID"),
        name: z.string().trim().min(1).optional(),
        nominal: z.number().positive().optional().describe("Amount of money in the user's preferred currency"),
        category: z.string().trim().min(1).optional().describe("Category name — use list_categories to see available categories"),
        date: z.string().optional().describe("Entry date in YYYY-MM-DD format"),
        io: z.enum(["Income", "Expenses"]).optional(),
      },
    },
    async ({ id, name, nominal, category, date, io }) => {
      try {
        if (date && !isValidDate(date)) throw new Error("Date must be a valid YYYY-MM-DD value");
        const managementId = getManagementId();
        const ctx = await getUserCurrencyContext();
        const idrNominal = nominal !== undefined ? await toIdrAmount(nominal, ctx) : undefined;
        const exchangeRateToIdr = ctx.currency === "IDR" ? 1 : 1 / ctx.rate;
        const entry = await updateEntry(id, {
          name,
          nominal: idrNominal,
          ...(nominal !== undefined
            ? {
                originalNominal: nominal,
                originalCurrency: ctx.currency,
                exchangeRateToIdr,
                exchangeRateAt: new Date(),
              }
            : {}),
          category,
          date,
          io,
          managementId,
        });
        const management = await prisma.management.findUnique({ where: { id: managementId }, select: { name: true } });
        return ok(`Updated cashflow entry in ${management?.name ?? managementId}.`, {
          ...entry,
          nominal: entry.originalNominal ?? fromIdrAmount(entry.nominal, ctx),
          currency: entry.originalCurrency ?? ctx.currency,
          nominalIdr: entry.nominal,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "delete_entry",
    {
      title: "Delete Cashflow Entry",
      description: "Permanently delete a cashflow entry by ID. This cannot be undone.",
      inputSchema: { id: z.string().min(1).describe("Entry ID") },
    },
    async ({ id }) => {
      try {
        await deleteEntry(id, getManagementId());
        return ok("Deleted cashflow entry.", { id });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
