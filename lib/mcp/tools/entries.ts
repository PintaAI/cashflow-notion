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
import { isValidDate, ok, toolError, getManagementId, getUserId, toIdrAmount } from "@/lib/mcp/tools/utils";

const entryFields = {
  name: z.string().trim().min(1).describe("Entry name"),
  nominal: z.number().positive().describe("Amount of money in the user's preferred currency"),
  category: z.string().trim().min(1).optional().describe("Category name — use list_categories to see available categories"),
  date: z.string().optional().describe("Entry date in YYYY-MM-DD format"),
  io: z.enum(["Income", "Expenses"]).describe("Whether this entry is Income or Expenses"),
};

function toEntry(entry: Awaited<ReturnType<typeof prisma.entry.findFirst>> & { category?: { name: string } | null }) {
  if (!entry) return null;
  return {
    id: entry.id,
    name: entry.name,
    nominal: entry.nominal,
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
        const entries = await prisma.entry.findMany({
          where: { managementId: mid, ...buildEntryWhere({ io: io as IOType | undefined, category, date }) },
          include: { category: true },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          skip,
          take: pageSize + 1,
        });
        const items = entries.slice(0, pageSize).map((entry) => ({
          id: entry.id,
          name: entry.name,
          nominal: entry.nominal,
          category: entry.category?.name ?? null,
          date: entry.date,
          io: entry.io,
        }));

        return ok(`Found ${items.length} cashflow entr${items.length === 1 ? "y" : "ies"}.`, {
          entries: items,
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
        return ok("Found cashflow entry.", toEntry(entry));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "create_entry",
    {
      title: "Create Cashflow Entry",
      description: "Create a new income or expense entry.",
      inputSchema: entryFields,
    },
    async ({ name, nominal, category, date, io }) => {
      try {
        if (date && !isValidDate(date)) throw new Error("Date must be a valid YYYY-MM-DD value");

        const managementId = getManagementId();
        const idrNominal = await toIdrAmount(nominal);
        const entry = await createEntry({ name, nominal: idrNominal, category, date, io, managementId, userId: getUserId() });
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
              .map((s) => `⚠ ${s.isOverBudget ? "OVER" : "Near"} ${s.type === "overall" ? "total" : s.name} ${s.period} budget: ${s.percentage}% (${s.spent} / ${s.budgetAmount} IDR)`)
              .join("\n");
          }
        }

        const message = warnings
          ? `Created cashflow entry in ${management?.name ?? managementId}.\n\nBudget Warnings:\n${warnings}`
          : `Created cashflow entry in ${management?.name ?? managementId}.`;

        return ok(message, { ...entry, managementName: management?.name ?? null, budgetWarnings: warnings ?? null });
      } catch (error) {
        console.error("MCP: create_entry failed", error instanceof Error ? error.message : error);
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
        const idrNominal = nominal !== undefined ? await toIdrAmount(nominal) : undefined;
        const entry = await updateEntry(id, { name, nominal: idrNominal, category, date, io, managementId });
        const management = await prisma.management.findUnique({ where: { id: managementId }, select: { name: true } });
        return ok(`Updated cashflow entry in ${management?.name ?? managementId}.`, entry);
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
